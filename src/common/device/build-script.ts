import path from 'path';
import { KllFile, KllLayout } from '../config/kll';
import { BuildTarget } from './build-targets';

/**
 * Pure helpers for assembling the local firmware build: CMake arguments and
 * the WSL `build.sh` script. Kept free of Electron so they can be unit tested.
 */

export interface ToolchainRefs {
  controller: string;
  kll: string;
  python: string;
  generator: string;
}

export const wslRefs: ToolchainRefs = {
  controller: '$CONTROLLER',
  kll: '$KLL',
  python: '$PYTHON',
  generator: '$GENERATOR',
};

/** Paths needed to write `build.sh`. The rest of the toolchain lives in compile.ts. */
export interface BuildScriptToolchain {
  controller: string;
  kll: string;
  layouts: string;
  cmake: string;
  python: string;
  extraPath: string;
}

/** Layer arguments as the compile server built them, i.e. `<extra> <layer>`. */
export function mapArgument(extraMap: string, layer: Optional<KllFile>): string {
  return layer ? `${extraMap} ${path.basename(layer.name, '.kll')}` : extraMap;
}

/** Backslashes are escape characters to cmake, so paths are passed unix style. */
export function cmakePath(value: string): string {
  return value.replace(/\\/g, '/');
}

/** Whether a configured path refers to something this process can see. */
export function isWindowsPath(value: string): boolean {
  return /^[a-z]:[\\/]/i.test(value) || value.includes('\\');
}

/** A shell expression for a configured path, translating Windows paths. */
export function wslPath(value: string): string {
  return isWindowsPath(value) ? `$(wslpath -a '${value}')` : `'${value}'`;
}

export function shellArgument(value: string): string {
  // Arguments naming a variable the script sets have to stay expandable
  return value.includes('$') ? `"${value}"` : `'${value.replace(/'/g, `'\\''`)}'`;
}

export function cmakeArguments(target: BuildTarget, kll: KllLayout, extraMap: string, refs: ToolchainRefs): string[] {
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

/**
 * The build as a shell script, so that neither Windows nor wsl.exe gets a say
 * in quoting. It is left in the build directory and can be run by hand.
 */
export function buildScript(toolchain: BuildScriptToolchain, args: string[]): string {
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
