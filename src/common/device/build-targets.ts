/**
 * CMake parameters for each supported board, mirroring the convenience scripts
 * in `Keyboards/` of the kiibohd controller firmware. The values here are what
 * `Keyboards/<board>.bash` would have exported before sourcing `cmake.bash`,
 * so a build driven from this application produces the same firmware as one
 * driven from the shell.
 */

export interface BuildTarget {
  /** Empty for a single sided board, otherwise the half being built. */
  side: '' | 'left' | 'right';
  scanModule: string;
  macroModule: string;
  outputModule: string;
  debugModule: string;
  chip: string;
  compiler: string;
  baseMap: string;
  layoutName: string;
  vendorId: string;
  productId: string;
  bootVendorId: string;
  bootProductId: string;
}

export interface BoardBuild {
  /** Prepended to every generated layer, as the compile server did. */
  extraMap: string;
  targets: BuildTarget[];
}

// Defaults from Keyboards/cmake.bash
const defaults = {
  outputModule: 'USB',
  debugModule: 'full',
  compiler: 'gcc',
  vendorId: '0x1C11',
  productId: '0xB04D',
  bootVendorId: '0x1C11',
  bootProductId: '0xB007',
};

type BoardDefinition = {
  extraMap?: string;
  /** Variants are keyed by the `header.Variant` field of the layout. */
  productIds?: Dictionary<string>;
  /** Appends `scancode_map.<variant>` to the base map when true. */
  variantBaseMap?: boolean;
  /** Included in the firmware's product string. */
  variantLayoutName?: boolean;
  sides?: Dictionary<{ baseMap: string; productId: string }>;
} & Partial<BuildTarget> &
  Pick<BuildTarget, 'scanModule' | 'macroModule' | 'chip' | 'baseMap'>;

const boards: Dictionary<BoardDefinition> = {
  MDErgo1: {
    scanModule: 'Infinity_Ergodox',
    macroModule: 'PixelMap',
    chip: 'mk20dx256vlh7',
    baseMap: 'scancode_map',
    vendorId: '0x308F',
    extraMap: 'infinity_ergodox/lcdFuncMap',
    sides: {
      left: { baseMap: 'scancode_map leftHand slave1 rightHand', productId: '0x0004' },
      right: { baseMap: 'scancode_map rightHand slave1 leftHand', productId: '0x0025' },
    },
  },
  MD1: {
    scanModule: 'Infinity_60',
    macroModule: 'PartialMap',
    chip: 'mk20dx128vlf5',
    baseMap: 'scancode_map',
    vendorId: '0x308F',
    variantBaseMap: true,
    variantLayoutName: true,
    productIds: { hacker: '0x0001', standard: '0x0002' },
  },
  'MD1.1': {
    scanModule: 'Infinity_60_LED',
    macroModule: 'PixelMap',
    chip: 'mk20dx128vlf5',
    baseMap: 'scancode_map',
    vendorId: '0x308F',
    variantBaseMap: true,
    variantLayoutName: true,
    productIds: { alphabet: '0x000F', hacker: '0x000E', standard: '0x000D' },
  },
  WhiteFox: {
    scanModule: 'WhiteFox',
    macroModule: 'PixelMap',
    chip: 'mk20dx256vlh7',
    baseMap: 'scancode_map',
    vendorId: '0x308F',
    variantBaseMap: true,
    variantLayoutName: true,
    productIds: {
      aria: '0x0008',
      iso: '0x0007',
      jackofalltrades: '0x000B',
      truefox: '0x000A',
      vanilla: '0x0006',
      winkeyless: '0x0009',
    },
  },
  KType: {
    scanModule: 'K-Type',
    macroModule: 'PixelMap',
    chip: 'mk20dx256vlh7',
    baseMap: 'scancode_map',
    vendorId: '0x308F',
    productId: '0x0011',
  },
  Kira: {
    scanModule: 'Kira',
    macroModule: 'PixelMap',
    chip: 'sam4s8b',
    baseMap: 'scancode_map',
    vendorId: '0x308F',
    productId: '0x0013',
    bootVendorId: '0x308F',
    bootProductId: '0x0012',
  },
};

/**
 * @param board The `header.Name` of the layout, e.g. `MDErgo1`.
 * @param variant The `header.Variant` of the layout, e.g. `truefox`.
 */
export function buildTargets(board: string, variant: string): BoardBuild {
  const def = boards[board];

  if (!def) {
    throw Error(`No firmware build configuration for '${board}'`);
  }

  const common: BuildTarget = {
    ...defaults,
    ...def,
    side: '',
    layoutName: def.variantLayoutName ? variant : '',
    baseMap: def.variantBaseMap ? `${def.baseMap} scancode_map.${variant}` : def.baseMap,
    productId: def.productIds?.[variant] ?? def.productId ?? defaults.productId,
  };

  const targets = !def.sides
    ? [common]
    : Object.entries(def.sides).map(([side, overrides]) => ({
        ...common,
        ...overrides,
        side: side as BuildTarget['side'],
      }));

  return { extraMap: def.extraMap ?? 'stdFuncMap', targets };
}
