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
- Flash a firmware binary you already have on disk (if `dfu-util` is already
  installed on the machine)

Clicking **Flash Keyboard** in the editor is the compile action. It does
**not** compile. It shows an error on purpose.

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

KiiConf itself is **not** bundled here. It was only the web front-end that
turned JSON into a firmware build.

## Sibling firmware repos (local forks)

Firmware compilation is **not wired up** in this app yet. When it is, it
must use **local clones only**, never a network compile service.

These forks sit next to this repo:

| Role | Local path | GitHub fork |
| --- | --- | --- |
| This desktop app | `../kiibohd-Configurator` | https://github.com/MarkDrei/kiibohd-Configurator |
| Keyboard firmware / ARM build scripts | `../kiibohd-Controller` | https://github.com/MarkDrei/kiibohd-Controller |
| KLL compiler | `../kiibohd-kll` | https://github.com/MarkDrei/kiibohd-kll |

From this directory that is:

```text
../kiibohd-Controller
../kiibohd-kll
```

`kiibohd/controller` (here: Controller) holds `Keyboards/*.bash` and the
firmware tree. `kiibohd/kll` compiles Key Layout Language. Historical KiiConf
called those tools from PHP/`build_layout.bash` after converting JSON to KLL.
A future local compile path should invoke the sibling Controller and kll
checkouts with a local ARM GCC/cmake/Python toolchain — not HTTP.

Do not clone or fetch from `input.club`. Prefer these forks and other copies
you already have on disk.

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

`yarn dev` starts the UI only. It does not start a firmware compiler.
