<p align="center">
  <img src="assets/static/icon.png" height="180" alt="DrawPen icon">
  <h1 align="center">DrawPen Classroom Edition</h1>
  <p align="center">A community-maintained DrawPen build for teaching on Fedora 44 and Windows x64</p>
</p>

<p align="center">
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-blue.svg"></a>
  <img alt="Tested on Fedora 44" src="https://img.shields.io/badge/Fedora-44-51A2DA?logo=fedora&logoColor=white">
  <img alt="Display: native Wayland" src="https://img.shields.io/badge/Display-Wayland_native-6B5DD3">
  <img alt="Windows x64 build" src="https://img.shields.io/badge/Windows-x64-0078D4?logo=windows11&logoColor=white">
  <img alt="Status: community build" src="https://img.shields.io/badge/Status-Community_build-orange">
</p>

> [!IMPORTANT]
> This is an **unofficial community derivative** of [DmytroVasin/DrawPen](https://github.com/DmytroVasin/DrawPen). It is not published, maintained, or endorsed by the upstream author. The original copyright notice and MIT license are preserved.

![DrawPen](assets/static/main.png)

## Why this edition exists

This edition keeps the upstream DrawPen structure and adds classroom-oriented drawing tools. It runs natively on **Fedora 44's Wayland session**, on any desktop environment, instead of forcing the X11 compatibility path. A separate `drawpen-x11` package remains available for cases that still need X11 (for example, desktops without a working `GlobalShortcuts` portal). A separately identified Windows x64 package carries the classroom tools while leaving the Linux-only code inactive.

## Highlights

- Runs natively on Wayland, with an X11-forced `drawpen-x11` build for desktops that still need it.
- Stable toolbar placement while switching between Pointer Mode and Draw Mode, including restoration after restart, on both Wayland and X11.
- X11 input-region shaping so Pointer Mode allows clicks to pass through to applications underneath the canvas (`drawpen-x11` build).
- White, cream, blue, slate, and black boards with configurable size, opacity, spacing, dots, lines, grid, or polka patterns.
- Full-screen capture saved to the user's `Pictures/Screenshots` directory.
- Pen width slider from 2 to 32 px with live cursor preview.
- Preset and custom drawing colors shared by drawing tools.
- Straight and dashed lines (adjustable dash size and spacing), arrows, squares, rectangles, circles, ovals, triangles, and configurable tables/matrices.
- Numbered horizontal or vertical lines for axes, with configurable bounds and classroom-friendly label spacing.
- Bold text support.

See [CHANGELOG.md](CHANGELOG.md) for the complete change summary, [FEDORA_44_COSMIC.md](FEDORA_44_COSMIC.md) for Fedora notes, and [WINDOWS.md](WINDOWS.md) for Windows installation and trust information.

## Installation on Fedora 44

Download the RPM from the [latest release](https://github.com/MAlexVR/DrawPen-Classroom/releases/latest), then install it with:

```bash
sudo dnf install ./drawpen-<version>-1.x86_64.rpm
```

This runs DrawPen natively on Wayland. If you need the X11 compatibility backend instead (for example, on a desktop where the global show/hide shortcut doesn't register under Wayland), install the `drawpen-x11` package from the same release:

```bash
sudo dnf install ./drawpen-x11-<version>-1.x86_64.rpm
```

After installation, launch **DrawPen** (or **DrawPen (X11)**) from your application launcher. The release notes include the SHA-256 checksum for each package — verify the downloaded file with `sha256sum` before installing.

## Installation on Windows x64

Download `DrawPen-Classroom-Windows-x64.Setup.exe` from the [Windows classroom release](https://github.com/MAlexVR/DrawPen-Classroom/releases/tag/v0.0.56-windows-classroom.1) and run it as your normal user. Administrator privileges are not required by the Squirrel installer.

> [!WARNING]
> This community build is not digitally signed. Windows SmartScreen may display an unknown-publisher warning. Verify the SHA-256 checksum published in the release before running it. Do not disable SmartScreen globally.

The Windows package uses the application name **DrawPen Classroom** and a separate application identifier so it is distinguishable from the official DrawPen package. See [WINDOWS.md](WINDOWS.md) for portable ZIP, installation, verification, and testing details.

## Main controls

| Action | Shortcut or control |
| --- | --- |
| Switch Draw/Pointer Mode | <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>A</kbd> |
| Pen | <kbd>P</kbd> or <kbd>1</kbd> |
| Cycle shapes | <kbd>2</kbd> |
| Numbered line | <kbd>N</kbd> |
| Text | <kbd>T</kbd> or <kbd>3</kbd> |
| Toggle bold while editing text | <kbd>Ctrl</kbd> + <kbd>B</kbd> |
| Highlighter | <kbd>H</kbd> or <kbd>4</kbd> |
| Laser | <kbd>L</kbd> or <kbd>5</kbd> |
| Eraser | <kbd>E</kbd> or <kbd>6</kbd> |
| Switch color | <kbd>7</kbd> |
| Switch width | <kbd>8</kbd> |
| Show/hide toolbar | <kbd>Ctrl</kbd> + <kbd>T</kbd> |
| Show/hide board | <kbd>Ctrl</kbd> + <kbd>E</kbd> |
| Clear drawings | <kbd>Ctrl</kbd> + <kbd>K</kbd> |
| Settings | <kbd>Ctrl</kbd> + <kbd>,</kbd> |

Pointer Mode makes the full-screen drawing surface click-through while keeping the compact toolbar interactive. Draw Mode captures pointer input so you can annotate the screen.

## Build from source

Prerequisites:

- Fedora 44 on x86_64 or Windows x64.
- Node.js 22.22.x.
- C compiler, X11 development libraries, and RPM packaging tools for Fedora builds.

For the complete development and packaging instructions, see [CONTRIBUTING.md](CONTRIBUTING.md).

## Upstream relationship

This repository is based on upstream DrawPen 0.0.56. General-purpose fixes and features should be proposed to the [upstream project](https://github.com/DmytroVasin/DrawPen) whenever they can be separated cleanly from the Fedora/Linux compatibility layer. Include the operating system and display configuration in platform-specific reports.

## License and attribution

DrawPen was created by Dmytro Vasin and contributors. This derivative preserves the upstream copyright notice and is distributed under the same [MIT License](LICENSE). See [NOTICE.md](NOTICE.md) for attribution and project-status details.
