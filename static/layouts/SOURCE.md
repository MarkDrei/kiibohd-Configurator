Bundled keyboard layouts
========================

These JSON files were copied from the `layouts` directory of:

https://github.com/kiibohd/KiiConf

Source revision: `5f7ee179f2d79506dc3aeeede0e43ca11a45428e`

The source repository and this application are licensed under GPL-3.0.
Files represented as symbolic links upstream were resolved and stored here as
ordinary JSON files so packaged Windows builds remain self-contained.

Two kinds of file live here:

* Editable layouts, named `{board}-{layout}.json`, offered in the UI.
* Base layouts, referenced by the `header.Base` field of an editable layout.
  These are never shown in the UI. Firmware compilation diffs the edited
  layout against its base to work out which keys were remapped, so a base
  file must exist for every layout that can be compiled.

The `.lts.json` base variants were not copied; the LTS firmware channel is
not supported by this application.
