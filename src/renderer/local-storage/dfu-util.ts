import path from 'path';
import fs from 'fs';
import Bluebird from 'bluebird';
import { paths } from '../env';
import commandExists from 'command-exists';

const access = Bluebird.promisify(fs.access);

const info = {
  version: '0.9',
};

export async function findDfuPath(): Promise<string> {
  const win32 = process.platform === 'win32';
  const name = win32 ? 'dfu-util.exe' : 'dfu-util';

  // Prefer the configurator downloaded version (they can always override)
  const localpath = path.join(paths.utils, `dfu-util_v${info.version}`, win32 ? 'dfu-util.exe' : 'dfu-util');
  try {
    await access(localpath);
    return localpath;
  } catch {
    // Just swallow
  }

  try {
    const onPath = await commandExists(name);
    if (onPath) {
      return 'dfu-util';
    }
  } catch {
    // Just swallow
  }

  return '';
}
