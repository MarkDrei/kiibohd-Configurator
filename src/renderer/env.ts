import path from 'path';
import electron from 'electron';

const dataDir = electron.remote.app.getPath('userData');
const firmwareCacheDir = path.join(dataDir, 'firmware-cache');
const utilsDir = path.join(dataDir, 'utils');
const buildDir = path.join(dataDir, 'builds');

export const paths = {
  data: dataDir,
  firmwareCache: firmwareCacheDir,
  utils: utilsDir,
  builds: buildDir,
};
