# Standalone Kiibohd Configurator

This fork is meant to run **offline**. Do not send layouts, firmware, or
driver requests to any remote host, and do not use `input.club` at all.

The old Input Club sites (`input.club`, `vash.input.club`,
`configurator.input.club`, and similar) are untrusted. The original compile
host is gone; the domain has been reported as lost/squatted and is now a
spam/malware risk. Treat anything served from those names as hostile.

This application no longer:

- downloads default layouts
- posts keymaps to a compile server
- checks GitHub for app updates
- downloads `dfu-util` or `kiidrv`

Help menu items that open documentation still use the system browser. Those
are optional and are not required to edit layouts.

## What works locally

- Select a supported keyboard and variant
- Edit keys, layers, macros, and (where present) visuals
- Import / export layout JSON from disk
- Compile firmware, using local checkouts of the controller firmware and the
  KLL compiler (see below)
- Flash a firmware binary, either one just compiled or one already on disk
  (requires `dfu-util`)

Clicking **Flash Keyboard** in the editor compiles the current layout and then
offers to flash the result. Everything runs as local processes; no layout ever
leaves the machine.

## Usage

### Setting up, once

1. Clone the sibling repos next to this one, plus
   [hid-io/layouts](https://github.com/hid-io/layouts). See the table under
   *Firmware compilation*.
2. Install the toolchain. On Windows that means installing it inside WSL; see
   *Building on Windows* for the exact package list.
3. Open **Settings > Firmware** and fill in the paths. A working Windows
   setup looks like this:

   | Setting | Value |
   | --- | --- |
   | Build in WSL | on |
   | WSL distribution | empty, or e.g. `Ubuntu` |
   | Controller firmware | `C:\...\kiibohd-Controller` |
   | KLL compiler | `C:\...\kiibohd-kll` |
   | HID layouts | `C:\...\layouts` |
   | CMake | `cmake` |
   | Python 3 | `/home/<user>/.kiibohd/venv/bin/python3` |
   | Additional PATH | empty |

   The checkouts stay on the Windows side; only Python and the build tools
   come from WSL.
4. On Windows, install the flashing driver from **Settings > Drivers**.

### Changing a layout

Pick the keyboard and variant, edit keys, layers, macros or visuals, then
click **Flash Keyboard**. That compiles the current layout and streams the
build log into a dialog; when it finishes, **Flash** hands the result to the
flashing panel. The Infinity Ergodox produces two binaries and both halves are
flashed, one at a time.

A build takes roughly a minute from cold and less on repeat, since each layout
keeps its own build directory.

### Changing the firmware itself

Edit C sources in the controller checkout and press **Flash Keyboard** again.
The build directory is reused, so only what changed is recompiled.

Note that the build identity is derived from the layout plus the *committed*
revision of the controller and KLL checkouts. Uncommitted firmware changes
therefore land in the same firmware cache entry rather than a new one, which
is usually what you want while iterating, but means the cache no longer
distinguishes those builds.

Under the app's user data directory, `%APPDATA%\kiibohd-configurator` on
Windows:

- `builds/<board>-<layout>-<hash>/` is the CMake build tree, containing the
  generated `.kll` layer files and, for a WSL build, the `build.sh` that ran.
  Running that script by hand reproduces the build exactly.
- `firmware-cache/<board>_<layout>_<hash>/` holds the finished binaries, the
  full build log, and the layout JSON that produced them.

To debug a failing build, run the `build.sh` of the half that failed; it is
plain shell and prints every command.

## Bundled layout JSON

Default layouts live in `static/layouts/` inside this repo (copied into the
packaged app as `resources/static/layouts/`).

They are a snapshot of the `layouts/` directory from the historical
[kiibohd/KiiConf](https://github.com/kiibohd/KiiConf) tree, revision
`5f7ee179f2d79506dc3aeeede0e43ca11a45428e` (GPL-3.0). Symbolic links in that
tree were resolved to ordinary JSON files. See `static/layouts/SOURCE.md`.

File names match `{board}-{layout}.json`, for example `KType-Standard.json`.
Each file is a KIICONF layout: `header`, `matrix` (keys and layers), plus
optional `leds`, `macros`, `animations`, `defines`, `custom`, and `canned`.

Base layouts named by a layout's `header.Base` field are bundled too. They are
not offered in the UI; compilation needs them to work out which keys differ
from stock. See `static/layouts/SOURCE.md`.

## Firmware compilation

Compilation happens entirely on this machine. The app converts the layout to
KLL, then drives CMake against a local checkout of the controller firmware,
exactly as `Keyboards/<board>.bash` would.

### Sibling firmware repos (local forks)

| Role | Local path | GitHub fork |
| --- | --- | --- |
| This desktop app | `../kiibohd-Configurator` | https://github.com/MarkDrei/kiibohd-Configurator |
| Keyboard firmware / ARM build scripts | `../kiibohd-Controller` | https://github.com/MarkDrei/kiibohd-Controller |
| KLL compiler | `../kiibohd-kll` | https://github.com/MarkDrei/kiibohd-kll |
| Historical web front-end, for reference | `../kiibohd-KiiConf` | https://github.com/MarkDrei/KiiConf |

The KLL compiler also needs the HID layout definitions from
[hid-io/layouts](https://github.com/hid-io/layouts). Clone it next to the
others and point the app at it; see below.

Do not clone or fetch from `input.club`. Prefer these forks and other copies
you already have on disk.

### Required toolchain

Configure the paths under **Settings > Firmware**. The following have to be
installed separately:

- CMake, plus `ninja` (preferred) or `make`
- `arm-none-eabi-gcc`, for the Kinetis and SAM4S targets
- Python 3 with the `kll` compiler importable, either from the sibling
  `kiibohd-kll` checkout or installed with pip. `Lib/CMake/kll.cmake` requires
  at least version `0.5.7.16`.
- A checkout of `hid-io/layouts`
- `dfu-util`, for flashing

The **Additional PATH** setting is prepended to `PATH` for builds, which is the
simplest way to expose the ARM toolchain and `ninja` without changing the
system environment.

### Building on Windows

The firmware's CMake files run bash helper scripts as `/usr/bin/env bash` and
redirect to `/dev/null`, which cmd.exe cannot do, so **Build in WSL** is on by
default on Windows. The app writes the build as a `build.sh` into the build
directory and runs it with `wsl.exe --cd <build dir> -- bash ./build.sh`.
Generating a script avoids arguments being mangled on the way through
`wsl.exe`, and the script can be run by hand to reproduce a build.

Paths configured in the settings may be on either side of the boundary.
Windows paths are translated inside the script with `wslpath`, so the usual
arrangement of checkouts on a Windows drive works as is. Flashing is unchanged
and still happens on the Windows side, so `dfu-util` is needed there rather
than in WSL.

Setting up a distribution, tested on Ubuntu 24.04:

```bash
sudo apt install cmake ninja-build make gcc-arm-none-eabi \
	binutils-arm-none-eabi libnewlib-arm-none-eabi dfu-util python3-venv

# the kll compiler's dependencies, kept out of the system python
python3 -m venv ~/.kiibohd/venv
~/.kiibohd/venv/bin/pip install layouts GitPython packaging
```

Then set **Python 3** to `~/.kiibohd/venv/bin/python3` (written out in full).

One thing to watch for: if a checkout was made with `core.autocrlf=true`, the
firmware's shell scripts end up with carriage returns and the build dies at
link time with `/usr/bin/env: 'bash\r': No such file or directory`. The
`kiibohd-Controller` fork carries a `.gitattributes` that keeps those scripts
LF; an older checkout can be repaired with `git rm --cached -r .` followed by
`git reset --hard`.

### Why the HID layouts directory is required

The KLL compiler constructs the `layouts` PyPI package on every compile
(`kll/common/stage.py`), and that package downloads the `hid-io/layouts`
repository from GitHub when it is not given a local path. The `kiibohd-kll`
fork adds `--layouts-path` and the `KLL_LAYOUTS_PATH` environment variable for
this; the app sets the environment variable from the **HID layouts** setting,
and refuses to build without it. Given a path, `layouts-python` never contacts
GitHub.

### How a build is put together

The JSON to KLL conversion is a port of `download.php` from KiiConf, at the
same revision the bundled layouts came from; it lives in
`src/common/config/kll.ts`. Each layer becomes `{board}-{layout}-{n}.kll`,
containing only the keys that differ from the base layout.

Those files are written into the build directory, where
`Lib/CMake/kll.cmake` picks them up ahead of the layouts shipped with the KLL
compiler. Per-board CMake settings live in
`src/common/device/build-targets.ts` and mirror the `Keyboards/*.bash`
scripts. Split boards, i.e. the Infinity Ergodox, are built twice with
different base maps and product ids.

Build directories are kept under the app's user data directory in `builds/`,
keyed by layout and source revision, so rebuilds are incremental. Finished
firmware is copied into `firmware-cache/` alongside its build log, the
generated KLL, and the layout that produced it.

## Build this app (no remote compile server)

Use Node **12.14.x** (see `.node-version`) and Yarn 1. Native `usb` must be
built for Electron 8; do not let electron-builder rebuild it against a
modern Node.

```bash
yarn
# If usb fails to rebuild for Electron 8, compile that addon separately,
# then package with npmRebuild disabled:
yarn compile
yarn dist --dir -c.compression=store -c.mac.identity=null -c.npmRebuild=false
```

Run `output/win-unpacked/Kiibohd Configurator.exe` (Windows) or the matching
unpacked binary for your OS.
