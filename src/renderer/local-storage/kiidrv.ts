import path from 'path';
import fs from 'fs';
import { paths } from '../env';
import Bluebird from 'bluebird';

const access = Bluebird.promisify(fs.access);

const version = '1.5.2';

export async function findKiidrvPath(): Promise<string> {
  if (process.platform !== 'win32') {
    return '';
  }

  const localpath = path.join(paths.utils, `kiidrv_v${version}`, 'kiidrv.exe');
  try {
    await access(localpath);
    return localpath;
  } catch {
    // Just swallow
  }

  return '';
}
