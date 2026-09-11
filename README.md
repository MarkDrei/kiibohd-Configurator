# The Kiibohd Configurator

Standalone configuration and flashing software for Kiibohd-compatible keyboards.

See [STANDALONE.md](STANDALONE.md) for the offline trust model, bundled layouts,
and local sibling firmware repos. Do not use `input.club`.

[![Github Actions Status](https://github.com/kiibohd/configurator/workflows/Release/badge.svg)](https://github.com/kiibohd/configurator/actions)

[![Travis Status](https://travis-ci.org/kiibohd/configurator.svg?branch=master)](https://travis-ci.org/kiibohd/configurator) [![Appveyor Status](https://ci.appveyor.com/api/projects/status/keu6at9jdrlvd1g5/branch/master?svg=true)](https://ci.appveyor.com/project/kiibohd/configurator/branch/master)
[![Total alerts](https://img.shields.io/lgtm/alerts/g/kiibohd/configurator.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/kiibohd/configurator/alerts/)
[![Language grade: JavaScript](https://img.shields.io/lgtm/grade/javascript/g/kiibohd/configurator.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/kiibohd/configurator/context:javascript)


Default keyboard layouts are bundled in `static/layouts`; the application does not download layouts.

[Visit our Discord Channel](https://discord.gg/GACJa4f)

# --> [Wiki](https://kiibohd.github.io/wiki/#/Quickstart) <-- If you have questions start here

Firmware compilation is intentionally unavailable until a trusted local
compiler integration is provided. Existing local firmware files can still be
flashed.


## Supported Keyboards

* Infinity 60%
* Infinity 60% LED
* Infinity Ergodox
* WhiteFox/NightFox
* K-Type
* Kira

## Dependencies

### Windows

You will need to install Zadig drivers (automated through the `Settings > Drivers` tab )

### Linux

* Install dfu-util from your disto's package manager.
* Add the following to `/etc/udev/rules.d/60-kiibohd.rules` (you will need to create the new file).
  ```bash
  # UDEV rules for Kiibohd-compatible keyboards
  #
  # This will allow reflashing via dfu-util without using sudo
  #
  # This file must be placed at /etc/udev/rules.d/60-kiibohd.rules

  # Board
  SUBSYSTEMS=="usb", ATTRS{idVendor}=="1c11", ATTRS{idProduct}=="b04d", MODE="664", GROUP="plugdev"
  # Boot
  SUBSYSTEMS=="usb", ATTRS{idVendor}=="1c11", ATTRS{idProduct}=="b007", MODE="664", GROUP="plugdev"
  # Registered Board
  SUBSYSTEMS=="usb", ATTRS{idVendor}=="1209", ATTRS{idProduct}=="01c0", MODE="664", GROUP="plugdev"
  # Registered Boot
  SUBSYSTEMS=="usb", ATTRS{idVendor}=="1209", ATTRS{idProduct}=="01cb", MODE="664", GROUP="plugdev"
  # Official VID
  SUBSYSTEMS=="usb", ATTRS{idVendor}=="308f", MODE="664", GROUP="plugdev"
  ```


## Installation

Download the installer/binary for your platform from the [latest release](https://github.com/kiibohd/configurator/releases/latest)

## Arch Linux
There is an Arch linux package:
```bash
yay -Syu kiibohd-configurator-git
```

## Compilation

Only required if there is no release for your distribution.


### Requirements

* node 10.x
* yarn 1.x

### Linux

* libudev-dev
* build-essential

```bash
yarn
yarn dist:dir
cd output/linux-unpacked
./kiibohd-configurator
```

### macOS
* libusb

```bash
yarn
yarn dist:dir
cd output/mac
open -a Kiibohd\ Configurator.app
```


### Windows
* [chocolatey](https://chocolatey.org/)

__Setup__
```bash
# In Administrator shell
choco feature enable -n allowGlobalConfirmation
choco install python python2 nodejs yarn
```

```bash
yarn
yarn dist:dir
cd output/win-unpacked
"Kiibohd Configurator.exe"
```
