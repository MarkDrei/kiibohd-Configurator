import React, { useRef, useState, useLayoutEffect } from 'react';
import {
  makeStyles,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Fab,
  TextField,
  Theme,
  Typography,
} from '../../mui';
import { FlashOnIcon } from '../../icons';
import {
  useCoreState,
  startExecuting,
  stopExecuting,
  updatePanel,
  popupSimpleToast,
  Actions,
  Panels,
} from '../../state/core';
import { useSettingsState, addDownload } from '../../state/settings';
import { currentConfig } from '../../state/configure';
import { compileFirmware } from '../../local-storage/compile';
import log from 'loglevel';

const useStyles = makeStyles(
  (theme: Theme) =>
    ({
      icon: {
        marginRight: theme.spacing(1),
      },
      error: {
        color: theme.palette.error.main,
        marginBottom: theme.spacing(1),
      },
      log: {
        fontFamily: 'monospace',
      },
    } as const)
);

export default function CompileFirmwareButton() {
  const classes = useStyles({});
  const [keyboard] = useCoreState('keyboard');
  const [variant] = useCoreState('variant');
  const [toolchain] = useSettingsState('toolchain');
  const [executing] = useCoreState('executing');

  const [showLog, setShowLog] = useState(false);
  const [buildLog, setBuildLog] = useState('');
  const [error, setError] = useState<Optional<string>>(undefined);
  const [succeeded, setSucceeded] = useState(false);
  const logTextBox = useRef<HTMLInputElement | null>(null);

  const compiling = executing.includes(Actions.Compile);

  if (!variant || !keyboard) {
    log.error('Variant not set while CompileFirmwareButton is visible');
    throw Error('Invalid UI state - variant not set');
  }

  const board = keyboard.keyboard.names[0];

  useLayoutEffect(() => {
    if (logTextBox.current) {
      logTextBox.current.scrollTop = logTextBox.current.scrollHeight;
    }
  }, [buildLog]);

  const compile = async () => {
    if (compiling) return;

    startExecuting(Actions.Compile);
    setShowLog(true);
    setBuildLog('');
    setError(undefined);
    setSucceeded(false);

    try {
      const result = await compileFirmware({
        board,
        variant,
        config: currentConfig(),
        toolchain,
        onLog: (chunk) => setBuildLog((curr) => curr + chunk),
      });

      await addDownload(result);
      setSucceeded(true);
      popupSimpleToast('success', 'Firmware compiled');
    } catch (e) {
      log.error(e);
      setError(e.message);
      popupSimpleToast('error', 'Firmware compilation failed, check the build log');
    } finally {
      stopExecuting(Actions.Compile);
    }
  };

  const flash = () => {
    setShowLog(false);
    updatePanel(Panels.Flash);
  };

  return (
    <div>
      <Fab
        variant="extended"
        color="secondary"
        onClick={compile}
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
      <Dialog open={showLog} onClose={() => !compiling && setShowLog(false)} maxWidth="md" fullWidth>
        <DialogTitle>{compiling ? 'Compiling Firmware' : 'Firmware Build'}</DialogTitle>
        <DialogContent>
          {error && (
            <Typography variant="subtitle2" className={classes.error}>
              {error}
            </Typography>
          )}
          <TextField
            fullWidth
            multiline
            rows="20"
            margin="dense"
            variant="outlined"
            InputProps={{ inputRef: logTextBox, readOnly: true, classes: { input: classes.log } }}
            value={buildLog}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowLog(false)} disabled={compiling}>
            Close
          </Button>
          <Button color="primary" onClick={flash} disabled={!succeeded}>
            Flash
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
