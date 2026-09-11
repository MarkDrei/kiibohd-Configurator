import React from 'react';
import electron from 'electron';
import { makeStyles, Card, CardContent, CardHeader, IconButton, InputAdornment, TextField, Theme } from '../mui';
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

type PathFieldProps = {
  label: string;
  helperText: string;
  field: keyof Toolchain;
  value: string;
  directory?: boolean;
  required?: boolean;
};

function PathField(props: PathFieldProps) {
  const classes = useStyles({});
  const { label, helperText, field, value, directory, required } = props;

  const pick = async () => {
    const picked = await browse(label, !!directory);
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
        endAdornment: (
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
  const [toolchain] = useSettingsState('toolchain');

  return (
    <Card>
      <CardHeader
        title="Firmware compilation"
        subheader="Firmware is compiled on this machine from local checkouts. Nothing is uploaded."
      />
      <CardContent>
        <PathField
          required
          directory
          label="Controller firmware"
          helperText="Checkout of the kiibohd controller firmware, the directory containing CMakeLists.txt"
          field="controller"
          value={toolchain.controller}
        />
        <PathField
          directory
          label="KLL compiler"
          helperText="Checkout of the kll compiler. Leave empty if kll is installed for the Python below."
          field="kll"
          value={toolchain.kll}
        />
        <PathField
          label="CMake"
          helperText="cmake executable. A build tool is also needed: ninja (preferred) or make."
          field="cmake"
          value={toolchain.cmake}
        />
        <PathField
          label="Python 3"
          helperText="Python used to run the kll compiler"
          field="python"
          value={toolchain.python}
        />
        <PathField
          directory
          label="Additional PATH"
          helperText="Prepended to PATH for builds, e.g. the bin directory of the ARM toolchain"
          field="extraPath"
          value={toolchain.extraPath}
        />
      </CardContent>
    </Card>
  );
}
