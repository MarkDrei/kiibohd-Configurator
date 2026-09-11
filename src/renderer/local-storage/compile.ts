import ChildProcess from 'child_process';
import fs from 'fs';
import path from 'path';
import mkdirp from 'mkdirp';
import Bluebird from 'bluebird';
import { paths } from '../env';
import { generateKll, layoutHash, KllFile, KllLayout, PersistedConfig } from '../../common/config';
import { buildTargets, BuildTarget } from '../../common/device/build-targets';
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

/** Layer arguments as the compile server built them, i.e. `<extra> <layer>`. */
function mapArgument(extraMap: string, layer: Optional<KllFile>): string {
  return layer ? `${extraMap} ${path.basename(layer.name, '.kll')}` : extraMap;
}

/** Backslashes are escape characters to cmake, so paths are passed unix style. */
function cmakePath(value: string): string {
  return value.replace(/\\/g, '/');
}

/**
 * How the build refers to the configured paths. A WSL build cannot use them
 * directly, so it refers to variables that its script resolves with wslpath.
 */
interface ToolchainRefs {
  controller: string;
  kll: string;
  python: string;
  generator: string;
}

const wslRefs: ToolchainRefs = {
  controller: '$CONTROLLER',
  kll: '$KLL',
  python: '$PYTHON',
  generator: '$GENERATOR',
};

function nativeRefs(toolchain: Toolchain, env: NodeJS.ProcessEnv): ToolchainRefs {
  return {
    controller: cmakePath(toolchain.controller),
    kll: cmakePath(toolchain.kll),
    python: cmakePath(toolchain.python),
    generator: detectGenerator(env),
  };
}

function cmakeArguments(target: BuildTarget, kll: KllLayout, extraMap: string, refs: ToolchainRefs): string[] {
  const [defaultLayer, ...partialLayers] = kll.layers;

  const args = [
    '-G',
    refs.generator,
    `-DCHIP=${target.chip}`,
    `-DCOMPILER=${target.compiler}`,
    `-DScanModule=${target.scanModule}`,
    `-DMacroModule=${target.macroModule}`,
    `-DOutputModule=${target.outputModule}`,
    `-DDebugModule=${target.debugModule}`,
    // cmake.bash prefixes a non-empty layout name with a colon
    `-DLayoutName=${target.layoutName ? ':' + target.layoutName : ''}`,
    `-DBaseMap=${target.baseMap}`,
    `-DDefaultMap=${mapArgument(extraMap, defaultLayer)}`,
    `-DPartialMaps=${partialLayers.map((l) => mapArgument(extraMap, l)).join(';')}`,
    `-DVENDOR_ID=${target.vendorId}`,
    `-DPRODUCT_ID=${target.productId}`,
    `-DBOOT_VENDOR_ID=${target.bootVendorId}`,
    `-DBOOT_PRODUCT_ID=${target.bootProductId}`,
    '-DCONFIGURATOR=1',
  ];

  if (refs.python) {
    args.push(`-DPYTHON_EXECUTABLE=${refs.python}`);
  }

  if (refs.kll) {
    // KLL_EXECUTABLE is a command, not a path, so it is passed as a cmake list.
    // Lib/CMake/kll.cmake only derives the working directory when it locates the
    // compiler itself, so that has to be supplied alongside it.
    args.push(`-DKLL_EXECUTABLE=${refs.python || 'python3'};${refs.kll}/kll/kll`);
    args.push(`-DKLL_WORKING_DIRECTORY=${refs.kll}`);
  }

  args.push(refs.controller);

  return args;
}

/** Whether a configured path refers to something this process can see. */
function isWindowsPath(value: string): boolean {
  return /^[a-z]:[\\/]/i.test(value) || value.includes('\\');
}

/** A shell expression for a configured path, translating Windows paths. */
function wslPath(value: string): string {
  return isWindowsPath(value) ? `$(wslpath -a '${value}')` : `'${value}'`;
}

function shellArgument(value: string): string {
  // Arguments naming a variable the script sets have to stay expandable
  return value.includes('$') ? `"${value}"` : `'${value.replace(/'/g, `'\\''`)}'`;
}

/**
 * The build as a shell script, so that neither Windows nor wsl.exe gets a say
 * in quoting. It is left in the build directory and can be run by hand.
 */
function buildScript(toolchain: Toolchain, args: string[]): string {
  const cmake = shellArgument(toolchain.cmake);

  const lines = [
    '#!/usr/bin/env bash',
    '# Written by the Kiibohd Configurator.',
    'set -e',
    '',
    `CONTROLLER=${wslPath(toolchain.controller)}`,
    `PYTHON=${toolchain.python ? wslPath(toolchain.python) : "'python3'"}`,
    `export KLL_LAYOUTS_PATH=${wslPath(toolchain.layouts)}`,
  ];

  if (toolchain.kll) {
    lines.push(`KLL=${wslPath(toolchain.kll)}`);
  }

  if (toolchain.extraPath) {
    lines.push(`export PATH=${wslPath(toolchain.extraPath)}:$PATH`);
  }

  lines.push(
    '',
    'if command -v ninja > /dev/null; then',
    '\tGENERATOR=Ninja',
    'elif command -v make > /dev/null; then',
    "\tGENERATOR='Unix Makefiles'",
    'else',
    "\techo 'No build tool found. Install ninja-build (preferred) or make.' >&2",
    '\texit 1',
    'fi',
    '',
    'set -x',
    [cmake, ...args.map(shellArgument)].join(' \\\n\t'),
    `${cmake} --build .`,
    ''
  );

  return lines.join('\n');
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
