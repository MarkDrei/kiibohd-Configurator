import React from 'react';
import electron from 'electron';
import {
  makeStyles,
  Card,
  CardContent,
  CardHeader,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Switch,
  TextField,
  Theme,
  Typography,
} from '../mui';
import { FolderOpen } from '../icons';
import { useSettingsState, updateToolchain } from '../state/settings';
import { Toolchain } from '../local-storage/compile';

const useStyles = makeStyles(
  (theme: Theme) =>
    ({
      field: {
        marginBottom: theme.spacing(1),
      },
      input: {
        fontSize: 13,
      },
      note: {
        marginBottom: theme.spacing(2),
      },
    } as const)
);

async function browse(title: string, directory: boolean): Promise<Optional<string>> {
  const window = electron.remote.getCurrentWindow();
  const result = await electron.remote.dialog.showOpenDialog(window, {
    title,
    properties: [directory ? 'openDirectory' : 'openFile'],
  });

  return result.canceled ? undefined : result.filePaths[0];
}

type FieldProps = {
  label: string;
  helperText: string;
  field: keyof Toolchain;
  value: string;
  required?: boolean;
  /** Adds a button that browses for a directory, or for a file when false. */
  pickDirectory?: boolean;
};

function Field(props: FieldProps) {
  const classes = useStyles({});
  const { label, helperText, field, value, required, pickDirectory } = props;

  const pick = async () => {
    const picked = await browse(label, !!pickDirectory);
    if (picked) {
      updateToolchain({ [field]: picked });
    }
  };

  return (
    <TextField
      fullWidth
      className={classes.field}
      label={label}
      helperText={helperText}
      value={value}
      required={required}
      error={required && !value}
      margin="dense"
      variant="outlined"
      onChange={(e) => updateToolchain({ [field]: e.target.value })}
      InputProps={{
        classes: { input: classes.input },
        endAdornment: pickDirectory !== undefined && (
          <InputAdornment position="end">
            <IconButton onClick={pick}>
              <FolderOpen />
            </IconButton>
          </InputAdornment>
        ),
      }}
      InputLabelProps={{ classes: { root: classes.input } }}
    />
  );
}

export default function Firmware() {
  const classes = useStyles({});
  const [toolchain] = useSettingsState('toolchain');
  const { wsl } = toolchain;

  // Paths handed to a WSL build may live on either side of the boundary
  const inside = wsl ? ' Windows paths are translated for WSL.' : '';

  return (
    <Card>
      <CardHeader
        title="Firmware compilation"
        subheader="Firmware is compiled on this machine from local checkouts. Nothing is uploaded."
      />
      <CardContent>
        {process.platform === 'win32' && (
          <>
            <FormControlLabel
              control={<Switch checked={wsl} onChange={(e) => updateToolchain({ wsl: e.target.checked })} />}
              label="Build in WSL"
            />
            <Typography className={classes.note} variant="caption" color="textSecondary" display="block">
              The firmware&apos;s build scripts expect a posix shell, so a build run directly on Windows will not
              finish. Flashing still happens on the Windows side.
            </Typography>
            {wsl && (
              <Field
                label="WSL distribution"
                helperText="Leave empty to use the default distribution"
                field="wslDistro"
                value={toolchain.wslDistro}
              />
            )}
          </>
        )}
        <Field
          required
          pickDirectory
          label="Controller firmware"
          helperText={`Checkout of the kiibohd controller firmware, the directory containing CMakeLists.txt.${inside}`}
          field="controller"
          value={toolchain.controller}
        />
        <Field
          pickDirectory
          label="KLL compiler"
          helperText="Checkout of the kll compiler. Leave empty if kll is installed for the Python below."
          field="kll"
          value={toolchain.kll}
        />
        <Field
          required
          pickDirectory
          label="HID layouts"
          helperText="Checkout of hid-io/layouts. Required, as the kll compiler otherwise downloads it from GitHub."
          field="layouts"
          value={toolchain.layouts}
        />
        <Field
          label="CMake"
          helperText={`cmake executable${
            wsl ? ' in WSL' : ''
          }. A build tool is also needed: ninja (preferred) or make.`}
          field="cmake"
          value={toolchain.cmake}
        />
        <Field
          label="Python 3"
          helperText={`Python used to run the kll compiler${wsl ? ', e.g. a virtualenv inside WSL' : ''}`}
          field="python"
          value={toolchain.python}
        />
        <Field
          label="Additional PATH"
          helperText={`Prepended to PATH for builds, e.g. the bin directory of the ARM toolchain${
            wsl ? '. A path inside WSL.' : ''
          }`}
          field="extraPath"
          value={toolchain.extraPath}
        />
      </CardContent>
    </Card>
  );
}
