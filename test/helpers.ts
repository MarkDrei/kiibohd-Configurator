import fs from 'fs';
import path from 'path';
import { PersistedConfig } from '../../src/common/config/types';

export function loadLayout(filename: string): PersistedConfig {
  const file = path.join(__dirname, '..', 'static', 'layouts', filename);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function key(code: string, layers: Dictionary<{ key: string; label?: string }>, extras: { board?: number } = {}) {
  return {
    code,
    x: 0,
    y: 0,
    w: 4,
    h: 4,
    ...extras,
    layers,
  };
}
