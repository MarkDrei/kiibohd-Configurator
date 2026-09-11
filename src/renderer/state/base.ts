import { updateConfig } from './configure';

import { _currentState } from './settings';
import { updatePanel, Panels, reset as resetCoreState, popupSimpleToast, toggleLoading } from './core';
import { reset as resetConfigureState } from './configure';
import _ from 'lodash';
import fs from 'fs';
import Bluebird from 'bluebird';
import path from 'path';
import { PersistedConfig } from '../../common/config';
import { AvailableLocales } from '../../common/keys';
import { Keyboard } from '../../common/device/types';

const readFile = Bluebird.promisify(fs.readFile);

function resetConfig() {
  updatePanel(Panels.KeyboardSelect);
  resetCoreState();
  resetConfigureState();
}

export async function loadBundledConfig(
  keyboard: Keyboard,
  variant: string,
  layout?: string,
  locale?: AvailableLocales
) {
  try {
    const defLayout = keyboard.layouts[variant][0];
    const filename = `${keyboard.names[0]}-${layout || defLayout}.json`;
    const filepath = path.join(__static, 'layouts', filename);
    toggleLoading();
    const buffer = await readFile(filepath);
    const config: PersistedConfig = JSON.parse(buffer.toString('utf8'));
    updateConfig(config, locale || _currentState('locale'));
    toggleLoading();
  } catch (e) {
    resetConfig();
    popupSimpleToast('error', 'Failed to load layout');
  }
}

export async function loadLocalConfig(filepath: string, locale?: AvailableLocales) {
  try {
    toggleLoading();
    const buffer = await readFile(filepath);
    const config = JSON.parse(buffer.toString('utf8'));
    updateConfig(config, locale || _currentState('locale'));
    toggleLoading();
  } catch (e) {
    resetConfig();
    popupSimpleToast('error', 'Failed to load layout');
  }
}

export async function loadDefaultConfig(keyboard: Keyboard, variant: string) {
  const recentDls = _currentState('recentDls');
  const recent = _.head(recentDls[`${keyboard.display}__${variant}`] || []);

  if (recent && fs.existsSync(recent.json)) {
    return loadLocalConfig(recent.json);
  }

  return loadBundledConfig(keyboard, variant);
}
