import React from 'react';
import { useState, useEffect } from 'react';
import { makeStyles, Divider, Paper, Tab, Tabs } from '../mui';
import { AccountSettingsIcon, FlashOnIcon, FolderDownloadIcon, /*MovieRollIcon,*/ WindowsIcon } from '../icons';
import Preferences from './preferences';
// import Animations from './animations';
import Downloads from './downloads';
import Drivers from './drivers';
import Firmware from './firmware';
import { updateToolbarButtons } from '../state/core';
import { BackButton, SettingsButton, HomeButton, HelpButton } from '../buttons';

const useStyles = makeStyles({
  root: {
    flexGrow: 1,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  tabs: {
    minHeight: 72,
  },
  container: {
    padding: 8 * 3,
    overflow: 'auto',
  },
} as const);

export default function Settings() {
  const classes = useStyles({});
  const [index, setIndex] = useState(0);

  useEffect(() => {
    updateToolbarButtons(
      <>
        <BackButton />
        <SettingsButton />
        <HelpButton />
        <HomeButton />
      </>
    );
  }, []);

  return (
    <Paper square className={classes.root}>
      <Tabs variant="fullWidth" className={classes.tabs} value={index} onChange={(_, value) => setIndex(value)}>
        <Tab label="Preferences" icon={<AccountSettingsIcon />} />
        {/* <Tab label="Animations" icon={<MovieRollIcon />} /> */}
        <Tab label="Firmware" icon={<FlashOnIcon />} />
        <Tab label="Downloads" icon={<FolderDownloadIcon />} />
        <Tab label="Drivers" icon={<WindowsIcon />} disabled={process.platform !== 'win32'} />
      </Tabs>
      <Divider />
      <div className={classes.container}>
        {index === 0 && <Preferences />}
        {/* {index === 1 && <Animations />} */}
        {index === 1 && <Firmware />}
        {index === 2 && <Downloads />}
        {index === 3 && <Drivers />}
      </div>
    </Paper>
  );
}
