import _ from 'lodash';
import log from 'loglevel';
import { createSharedState } from '../shared-state/index';
import db from '../db';
import { findDfuPath } from '../local-storage/dfu-util';
import { findKiidrvPath } from '../local-storage/kiidrv';
import { ConfigAnimation } from '../../common/config';
import { FirmwareResult, normalizeFirmwareResult } from '../local-storage/firmware';
import { AvailableLocales } from '../../common/keys';

const dev = process.env.NODE_ENV === 'development';

log.setDefaultLevel(dev ? log.levels.INFO : log.levels.ERROR);

const DbKey = {
  dfuPath: 'dfu-path',
  kiidrvPath: 'kiidrv-path',
  lastDl: 'last-download',
  recentDls: 'recent-dls',
  cannedAnimations: 'canned-animations',
};

type SettingsState = {
  locale: AvailableLocales;
  dfu: Optional<string>;
  kiidrv: Optional<string>;
  dev: boolean;
  lastDl: Optional<FirmwareResult>;
  recentDls: Dictionary<FirmwareResult[]>;
  cannedAnimations: Dictionary<ConfigAnimation>;
};

const initialState: SettingsState = {
  locale: 'en-us',
  dev,
  dfu: undefined,
  kiidrv: undefined,
  lastDl: undefined,
  recentDls: {},
  cannedAnimations: {},
};

const {
  useSharedState: useSettingsState,
  setSharedState: setSettingsState,
  getSharedState: getSettingsState,
} = createSharedState(initialState);

export { useSettingsState };

export { getSettingsState as _currentState };

export async function loadFromDb() {
  setSettingsState('kiidrv', (await db.core.get(DbKey.kiidrvPath)) || (await findKiidrvPath()));
  setSettingsState('lastDl', normalizeFirmwareResult(await db.core.get(DbKey.lastDl)));
  setSettingsState('recentDls', (await db.core.get(DbKey.recentDls)) || {});
  setSettingsState('cannedAnimations', (await db.core.get(DbKey.cannedAnimations)) || {});
  // setSettingsState('locale', (await db.core.get(DbKey.locale)) || 'en-us');
  setSettingsState('dfu', (await db.core.get(DbKey.dfuPath)) || (await findDfuPath()));
}

export async function updateDfu(dfu: string) {
  setSettingsState('dfu', dfu);
  await db.core.set(DbKey.dfuPath, dfu);
}

export async function updateKiidrv(kiidrv: string) {
  setSettingsState('kiidrv', kiidrv);
  await db.core.set(DbKey.kiidrvPath, kiidrv);
}

export async function addDownload(download: FirmwareResult) {
  const key = `${download.board}__${download.variant}`;
  setSettingsState('lastDl', download);
  setSettingsState('recentDls', (curr) => {
    const dls = (curr[key] || []).filter((x) => x.hash !== download.hash);
    const updated = { ...curr, ...{ [key]: _.take([download, ...dls], 5) } };
    db.core.set(DbKey.recentDls, updated);
    return updated;
  });

  await db.core.set(DbKey.lastDl, download);
  await db.dl.set(download.time.toString(), download);
}

export function setLastDl(download: FirmwareResult) {
  setSettingsState('lastDl', download);
}
