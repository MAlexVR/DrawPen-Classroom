## Contributing

This repository is an unofficial Fedora 44 COSMIC derivative of [DmytroVasin/DrawPen](https://github.com/DmytroVasin/DrawPen). Keep compatibility-specific changes small and documented. General improvements that apply to all platforms should also be proposed upstream when practical.

1. [Fork](https://help.github.com/articles/fork-a-repo/) this repository to your own GitHub account and then [clone](https://help.github.com/articles/cloning-a-repository/) it to your local device
2. Install the dependencies: `npm install`
3. Build the code, start the app, and watch for changes: `npm start`

To make sure that your code works in the finished app, you can generate the binary:

```
$ npm run package
```

After that, you'll see the binary in the `out` folder 😀

### Fedora 44 COSMIC prerequisites

The X11 input-region helper requires a C compiler and X11 development headers:

```bash
sudo dnf install gcc libX11-devel libXext-devel rpm-build
```

Use Node.js 22.22.x, matching `.nvmrc` and the `engines` field in `package.json`. Test Pointer Mode click-through, toolbar dragging, mode alignment, position restoration, board controls, and screen capture before submitting a change.

### Contribution checklist

- Keep the original MIT copyright notice intact.
- Describe user-visible changes in `CHANGELOG.md`.
- State the Fedora, COSMIC, display-scaling, and monitor configuration used for testing.
- Avoid committing `node_modules`, `.webpack`, `out`, private configuration, or generated RPM files.
- Do not include personal screen captures, access tokens, or user configuration.

## Debug logging

To enable development-level logs in a packaged app, quit any running DrawPen instance and launch it from a terminal with `DRAWPEN_DEBUG=1`:

```bash
# macOS
DRAWPEN_DEBUG=1 /Applications/DrawPen.app/Contents/MacOS/DrawPen

# Linux
DRAWPEN_DEBUG=1 drawpen
```

This flag only enables additional logging; it does not change the app layout or enable other development-only behavior.


## Local settings

The app stores its settings between restarts in the file. To reset the settings on macOS, quit DrawPen and delete its configuration file:

```bash
# app.getPath('userData')
rm /Users/your_user_name/Library/Application\ Support/drawpen/config.json
```
