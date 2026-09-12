import ChildProcess from 'child_process';
import fs from 'fs';
import path from 'path';
import mkdirp from 'mkdirp';
import Bluebird from 'bluebird';
import { paths } from '../env';
import { generateKll, layoutHash, KllFile, PersistedConfig } from '../../common/config';
import { buildTargets, BuildTarget } from '../../common/device/build-targets';
import { buildScript, cmakeArguments, cmakePath, isWindowsPath, wslRefs } from '../../common/device/build-script';
import { FirmwareResult, storeBuildOutput } from './firmware';

const readFile = Bluebird.promisify(fs.readFile);
const writeFile = Bluebird.promisify(fs.writeFile);

export interface Toolchain {
  /** Checkout of https://github.com/kiibohd/controller (or a fork of it). */
  controller: string;
  /** Checkout of https://github.com/kiibohd/kll. Optional if kll is installed. */
  kll: string;
  /** Checkout of https://github.com/hid-io/layouts, read by the kll compiler. */
  layouts: string;
  cmake: string;
  python: string;
  /** Prepended to PATH for the build, e.g. the ARM toolchain's bin directory. */
  extraPath: string;
  /**
   * Build inside WSL. The firmware's cmake files run bash helper scripts as
   * `/usr/bin/env bash` and redirect to /dev/null, neither of which works when
   * cmake drives the build through cmd.exe.
   */
  wsl: boolean;
  /** Distribution to build in. Empty uses the default distribution. */
  wslDistro: string;
}

export interface CompileOptions {
  /** `header.Name` of the layout, e.g. `MDErgo1`. */
  board: string;
  /** Variant as named in the UI, used to group cached builds. */
  variant: string;
  config: PersistedConfig;
  toolchain: Toolchain;
  onLog: (chunk: string) => void;
}

export class CompileError extends Error {}

function run(
  command: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
  onLog: (chunk: string) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    onLog(`\n> ${command} ${args.join(' ')}\n`);
    const child = ChildProcess.spawn(command, args, { cwd, env });

    child.stdout.on('data', (d) => onLog(d.toString()));
    child.stderr.on('data', (d) => onLog(d.toString()));

    child.on('error', (e) => {
      const notFound = (e as NodeJS.ErrnoException).code === 'ENOENT';
      reject(new CompileError(notFound ? `'${command}' was not found` : `Could not run '${command}': ${e.message}`));
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new CompileError(`'${path.basename(command)}' exited with code ${code}`));
      }
    });
  });
}

/**
 * The revision of the firmware sources is part of the build identity, so that
 * updating the controller or kll checkout produces a new cache entry rather
 * than silently reusing firmware built from different sources.
 */
async function gitRevision(repo: string): Promise<string> {
  try {
    const head = (await readFile(path.join(repo, '.git', 'HEAD'))).toString().trim();

    if (!head.startsWith('ref: ')) {
      return head;
    }

    const ref = head.substring(5);

    try {
      return (await readFile(path.join(repo, '.git', ref))).toString().trim();
    } catch {
      const packed = (await readFile(path.join(repo, '.git', 'packed-refs'))).toString();
      return (
        packed
          .split('\n')
          .find((l) => l.endsWith(` ${ref}`))
          ?.split(' ')[0] ?? ref
      );
    }
  } catch {
    return '';
  }
}

/** Looks up an executable the way the build will, i.e. including `extraPath`. */
function findOnPath(name: string, env: NodeJS.ProcessEnv): boolean {
  const extensions = process.platform === 'win32' ? ['.exe', '.cmd', '.bat', ''] : [''];

  return (env.PATH ?? '')
    .split(path.delimiter)
    .filter((dir) => dir.length)
    .some((dir) => extensions.some((ext) => fs.existsSync(path.join(dir, name + ext))));
}

function detectGenerator(env: NodeJS.ProcessEnv): string {
  // Matches the preference order of Keyboards/cmake.bash
  if (findOnPath('ninja', env)) return 'Ninja';
  if (findOnPath('make', env)) return 'Unix Makefiles';

  throw new CompileError('Could not find a build tool. Install ninja (preferred) or make.');
}

function buildEnvironment(toolchain: Toolchain): NodeJS.ProcessEnv {
  // A WSL build gets its environment from the script it runs
  if (toolchain.wsl) {
    return process.env;
  }

  const env = { ...process.env };

  if (toolchain.extraPath) {
    env.PATH = `${toolchain.extraPath}${path.delimiter}${process.env.PATH ?? ''}`;
  }

  // Without this the kll compiler downloads HID layouts from GitHub
  env.KLL_LAYOUTS_PATH = toolchain.layouts;

  return env;
}

function nativeRefs(toolchain: Toolchain, env: NodeJS.ProcessEnv) {
  return {
    controller: cmakePath(toolchain.controller),
    kll: cmakePath(toolchain.kll),
    python: cmakePath(toolchain.python),
    generator: detectGenerator(env),
  };
}

async function loadBaseLayout(board: string, config: PersistedConfig): Promise<PersistedConfig> {
  const base = config.header?.Base;

  if (!base) {
    throw new CompileError(`The layout has no 'Base' header, so it cannot be compiled`);
  }

  const filename = `${board}-${base}.json`;

  try {
    const buffer = await readFile(path.join(__static, 'layouts', filename));
    return JSON.parse(buffer.toString('utf8'));
  } catch {
    throw new CompileError(`Could not read the base layout '${filename}'`);
  }
}

const BUILD_SCRIPT = 'build.sh';

async function runBuild(
  toolchain: Toolchain,
  buildDir: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  onLog: (chunk: string) => void
) {
  if (!toolchain.wsl) {
    await run(toolchain.cmake, args, buildDir, env, onLog);
    await run(toolchain.cmake, ['--build', '.'], buildDir, env, onLog);
    return;
  }

  await writeFile(path.join(buildDir, BUILD_SCRIPT), buildScript(toolchain, args));

  const distro = toolchain.wslDistro ? ['-d', toolchain.wslDistro] : [];

  // --cd takes the windows path as is, so the build happens where the layer
  // files were written and the firmware lands somewhere this process can read.
  await run('wsl.exe', [...distro, '--cd', buildDir, '--', 'bash', `./${BUILD_SCRIPT}`], buildDir, env, onLog);
}

async function assertToolchain(toolchain: Toolchain) {
  // Paths inside the WSL filesystem cannot be checked from here
  const visible = (value: string) => !toolchain.wsl || isWindowsPath(value);

  if (!toolchain.controller) {
    throw new CompileError('No controller firmware directory is configured. See Settings > Firmware.');
  }

  if (visible(toolchain.controller) && !fs.existsSync(path.join(toolchain.controller, 'CMakeLists.txt'))) {
    throw new CompileError(`'${toolchain.controller}' does not look like a controller firmware checkout.`);
  }

  if (toolchain.kll && visible(toolchain.kll) && !fs.existsSync(path.join(toolchain.kll, 'kll', 'kll'))) {
    throw new CompileError(`'${toolchain.kll}' does not look like a kll compiler checkout.`);
  }

  // The kll compiler falls back to downloading these from GitHub, which this
  // application will not do on the user's behalf.
  if (!toolchain.layouts) {
    throw new CompileError('No HID layouts directory is configured. See Settings > Firmware.');
  }

  if (visible(toolchain.layouts) && !fs.existsSync(toolchain.layouts)) {
    throw new CompileError(`The HID layouts directory '${toolchain.layouts}' does not exist.`);
  }
}

/**
 * Compile firmware for the current layout using local checkouts of the
 * controller firmware and the kll compiler. Nothing here talks to a network.
 */
export async function compileFirmware(options: CompileOptions): Promise<FirmwareResult> {
  const { board, variant, config, toolchain } = options;

  // The log is shown as the build runs and kept with the firmware afterwards.
  let log = '';
  const onLog = (chunk: string) => {
    log += chunk;
    options.onLog(chunk);
  };

  await assertToolchain(toolchain);

  const base = await loadBaseLayout(board, config);
  const kll = generateKll(config, base);
  const { extraMap, targets } = buildTargets(board, config.header?.Variant ?? '');

  const revisions = await Promise.all([gitRevision(toolchain.controller), gitRevision(toolchain.kll)]);
  const hash = layoutHash(kll, revisions.join(''));

  const env = buildEnvironment(toolchain);
  const refs = toolchain.wsl ? wslRefs : nativeRefs(toolchain, env);
  const files = kll.layers.filter((f): f is KllFile => !!f);

  onLog(`Building ${kll.name} (${hash})\n`);

  const bins: { side: BuildTarget['side']; path: string }[] = [];

  for (const target of targets) {
    const buildDir = path.join(paths.builds, `${kll.name}-${hash}`, target.side);

    await mkdirp(buildDir);
    for (const file of files) {
      await writeFile(path.join(buildDir, file.name), file.content);
    }

    if (target.side) {
      onLog(`\n=== ${target.side} half ===\n`);
    }

    await runBuild(toolchain, buildDir, cmakeArguments(target, kll, extraMap, refs), env, onLog);

    const bin = path.join(buildDir, 'kiibohd.dfu.bin');

    if (!fs.existsSync(bin)) {
      throw new CompileError('The build finished but produced no firmware binary');
    }

    bins.push({ side: target.side, path: bin });
  }

  return storeBuildOutput({
    board,
    variant,
    layout: kll.layout,
    hash,
    config,
    log,
    kll: files,
    bins,
  });
}
