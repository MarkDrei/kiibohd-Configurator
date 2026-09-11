import React, { useState } from 'react';
import { makeStyles, Snackbar, CircularProgress, Fab, Theme } from '../../mui';
import { FlashOnIcon } from '../../icons';
import {
  useCoreState,
  startExecuting,
  stopExecuting,
  Actions,
} from '../../state/core';
import { ErrorToast } from '../../toast';
import log from 'loglevel';

const standaloneCompileError =
  'Firmware compilation is unavailable in standalone mode. Build firmware with a trusted local KiiConf/controller toolchain, then flash the resulting firmware file.';

const useStyles = makeStyles(
  (theme: Theme) =>
    ({
      icon: {
        marginRight: theme.spacing(1),
      },
    } as const)
);

export default function CompileFirmwareButton() {
  const classes = useStyles({});
  const [variant] = useCoreState('variant');
  const [toast, setToast] = useState<JSX.Element | null>(null);
  const [executing] = useCoreState('executing');

  const compiling = executing.includes(Actions.Compile);

  if (!variant) {
    log.error('Variant not set while CompileFirmwareButton is visible');
    throw Error('Invalid UI state - variant not set');
  }

  const click = async () => {
    if (compiling) return;
    startExecuting(Actions.Compile);
    setToast(null);
    stopExecuting(Actions.Compile);
    setToast(
      <ErrorToast
        message={<span>{standaloneCompileError}</span>}
        actions={[]}
        onClose={() => setToast(null)}
      />
    );
  };

  return (
    <div>
      <Fab
        variant="extended"
        color="secondary"
        onClick={click}
        disabled={compiling}
        style={{ position: 'absolute', right: 0, top: -20 }}
      >
        {!compiling ? (
          <FlashOnIcon className={classes.icon} />
        ) : (
          <CircularProgress color="primary" className={classes.icon} size={24} thickness={3} />
        )}
        Flash Keyboard
      </Fab>
      <Snackbar anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }} open={!!toast}>
        {toast}
      </Snackbar>
    </div>
  );
}
