# Fedora 44 COSMIC notes

## Supported and tested environment

The packaged RPM in this repository was built and tested on:

- Fedora Linux 44, x86_64
- COSMIC desktop
- Electron 40.4.0
- X11 compatibility backend (`--ozone-platform=x11`)

This is a compatibility build, not a claim of native Wayland support. COSMIC remains the active desktop session while DrawPen runs through XWayland/X11 so Electron can provide a transparent overlay and the helper can shape its interactive input region.

## COSMIC-specific behavior

DrawPen uses two coordinated windows:

1. A full-screen transparent drawing surface.
2. A compact floating toolbar.

In Pointer Mode, the full-screen surface must stop intercepting mouse input while the toolbar remains clickable. On this build, `tools/linux/drawpen-x11-input-shape.c` applies the X11 Shape extension to the overlay's input region. It is rediscovered and reapplied when the toolbar moves or the window manager recreates the surface.

Toolbar position is persisted separately from transient window geometry. Mode switches reuse the saved anchor so that the compact and expanded controls stay aligned. This avoids the automatic centering, vertical drift, and first-toggle mismatch observed with Electron windows under COSMIC.

## Installation

```bash
sudo dnf install ./drawpen-0.0.56-1.x86_64.rpm
```

To remove the package:

```bash
sudo dnf remove drawpen
```

User settings remain in Electron's per-user application-data directory unless removed manually.

## Troubleshooting

Start the installed package from a terminal with debug logging:

```bash
DRAWPEN_DEBUG=1 drawpen --ozone-platform=x11
```

When reporting a bug, include:

- Fedora and COSMIC versions.
- Display scaling and monitor arrangement.
- Whether XWayland is available.
- Relevant terminal output with `DRAWPEN_DEBUG=1`.
- Exact steps for switching modes or dragging the toolbar.

Do not include private screen content in screenshots or logs.

## RPM integrity

Artifact: `drawpen-0.0.56-1.x86_64.rpm`

SHA-256:

```text
247f1cd8d570938851090a0f1de263b5249e924e2c4ec1cd5b366507f2410821
```
