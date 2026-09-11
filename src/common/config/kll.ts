import crypto from 'crypto';
import _ from 'lodash';
import { PersistedConfig, PersistedMatrix } from './types';

/**
 * Generation of KLL layer files from a configurator layout.
 *
 * This is a port of the `download.php` endpoint of KiiConf
 * (https://github.com/kiibohd/KiiConf, GPL-3.0) at revision
 * 5f7ee179f2d79506dc3aeeede0e43ca11a45428e, which is the same revision the
 * bundled layouts in `static/layouts` were taken from. The original ran on the
 * (now defunct) compile server; everything here happens locally.
 */

export interface KllFile {
  name: string;
  content: string;
}

export interface KllLayout {
  /** Sanitized `{board}-{layout}`, matching the generated file names. */
  name: string;
  board: string;
  layout: string;
  /**
   * Generated file per layer, indexed by layer number. A layer with no
   * remapped keys and no custom KLL produces no file.
   */
  layers: Optional<KllFile>[];
}

/** Matches the sanitization the compile server applied to header fields. */
function sanitize(value: Optional<string>): string {
  return (value ?? '').replace(/ /g, '_').replace(/[^a-z0-9._]/gi, '');
}

/**
 * The left hand side of every mapping is the key the *base* layout has in that
 * position, so a layer file only says how the board differs from stock.
 */
function baseKeys(config: PersistedConfig, base: PersistedMatrix, board: string): Optional<string>[] {
  // WhiteFox layouts contain fewer keys than their base, so positions cannot
  // be compared by index.
  if (board === 'WhiteFox') {
    return config.matrix.map((key) => base.find((b) => b.code === key.code)?.layers?.['0']?.key);
  }

  return config.matrix.map((_key, i) => base[i]?.layers?.['0']?.key);
}

function keyToKll(key: string): string {
  const [, , prefix, rest] = /^((CONS|SYS|#):)?([\s\S]+)/i.exec(key) ?? [];

  if (rest === undefined) {
    return `U"${key}"`;
  }

  // Raw KLL capability, e.g. `#:flashMode()`
  if (prefix === '#') {
    return rest;
  }

  if (prefix === 'CONS' || prefix === 'SYS') {
    return `${prefix}"${rest}"`;
  }

  return `U"${key}"`;
}

function headerToKll(header: Dictionary<string>): string {
  return _.map(header, (value, name) => `${name} = "${value}";`).join('\n');
}

function definesToKll(config: PersistedConfig): string {
  return (config.defines ?? []).map((d) => `${d.name} = "${d.value}";\n`).join('\n');
}

function animationsToKll(config: PersistedConfig): string {
  return _.map(config.animations, (animation, name) => {
    let frameCount = 0;
    let kll = `A[${name}] <= ${animation.settings};\n`;

    for (const frame of animation.frames) {
      if (frame.startsWith('#')) {
        kll += `${frame}\n`;
      } else {
        frameCount++;
        kll += `A[${name}, ${frameCount}] <= ${frame};\n`;
      }
    }

    return frameCount > 0 ? kll : `### ${name} is empty, skipping`;
  }).join('\n');
}

/**
 * Build the KLL layer files for a layout.
 *
 * @param config The layout being compiled.
 * @param base The layout named by `config.header.Base`, used as the reference
 *             for which key sits in each matrix position.
 */
export function generateKll(config: PersistedConfig, base: PersistedConfig): KllLayout {
  const board = sanitize(config.header?.Name);
  const layout = sanitize(config.header?.Layout);

  if (!board || !layout) {
    throw Error('Layout is missing the Name or Layout header, cannot generate KLL');
  }

  const bases = baseKeys(config, base.matrix, board);
  const layers: Dictionary<Map<string, string>> = {};

  config.matrix.forEach((key, i) => {
    const baseKey = bases[i];
    if (baseKey === undefined) return;

    _.forOwn(key.layers, (assigned, layer) => {
      if (!assigned?.key) return;
      layers[layer] = layers[layer] ?? new Map();
      layers[layer].set(baseKey, assigned.key);
    });
  });

  const header = headerToKll(config.header ?? {});
  const defines = definesToKll(config);
  const animations = animationsToKll(config);

  const indices = Object.keys(layers).map(Number);
  const files: Optional<KllFile>[] = [];

  for (let layer = 0; layer <= Math.max(0, ...indices); layer++) {
    const mappings = layers[layer];
    const custom = config.custom?.[layer];

    if (!mappings && !custom) continue;

    const remapped = _.map([...(mappings ?? [])], ([from, to]) => `U"${from}" : ${keyToKll(to)};`).join('\n');
    const sections =
      layer === 0 ? [header, defines, remapped, custom ?? '', animations, ''] : [header, remapped, custom ?? '', ''];

    files[layer] = {
      name: `${board}-${layout}-${layer}.kll`,
      content: sections.join('\n\n'),
    };
  }

  return { name: `${board}-${layout}`, board, layout, layers: files };
}

/**
 * Identifies a build. Firmware is cached under this, so it has to cover both
 * the layout and the toolchain that compiled it.
 */
export function layoutHash(layout: KllLayout, toolchainRevision: string): string {
  const contents = layout.layers.filter((f): f is KllFile => !!f).map((f) => f.content);

  return crypto
    .createHash('md5')
    .update([layout.board, layout.layout, toolchainRevision, ...contents].join(''))
    .digest('hex');
}
