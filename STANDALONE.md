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
- `dfu-util`, for flashing

The **Additional PATH** setting is prepended to `PATH` for builds, which is the
simplest way to expose the ARM toolchain and `ninja` without changing the
system environment.

### One network dependency to be aware of

The KLL compiler imports the `layouts` PyPI package and constructs it on every
compile (`kll/common/stage.py`). That package fetches HID layout data from
GitHub into a local cache the first time it is used. Populate that cache once
on a machine you trust, or pin it to a local copy, otherwise a compile will
reach out to the network.

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
