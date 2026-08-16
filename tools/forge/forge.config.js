require('dotenv').config();

const path = require('path');
const packageJson = require('./../../package.json');
const rootDir = process.cwd();

const linuxIconPng = path.join(rootDir, 'assets/build/icon_512.png');

module.exports = {
  packagerConfig: {
    asar: true,
    extraResource: process.platform === 'linux'
      ? [path.join(rootDir, 'assets/build/drawpen-x11-input-shape')]
      : [],
    executableName: process.platform === 'linux'
      ? packageJson.name
      : process.platform === 'win32'
        ? 'DrawPen Classroom'
        : packageJson.productName,
    icon: path.join(rootDir, 'assets/build/icon'),
    appBundleId: process.platform === 'win32'
      ? 'io.github.malexvr.drawpenclassroom'
      : packageJson.appId,
    ...(process.argv.includes('--no-sign')
      ? {}
      : {
        osxSign: {},
        osxNotarize: {
          tool: 'notarytool',
          appleId: process.env.APPLE_ID,
          appleIdPassword: process.env.APPLE_PASSWORD,
          teamId: process.env.APPLE_TEAM_ID,
        },
      }),
  },
  makers: [
    {
      name: '@electron-forge/maker-dmg',
      config: {
        overwrite: true,
        background: path.join(rootDir, 'assets/build/background-dmg.png'),
        icon: path.join(rootDir, 'assets/build/icon.icns'),
        additionalDMGOptions: {
          window: { size: { width: 660, height: 500 } }
        },
      }
    },
    {
      name: "@electron-forge/maker-squirrel",
      platforms: ['win32'],
      config: {
        setupIcon: path.join(rootDir, 'assets/build/icon.ico'),
        iconUrl: 'https://raw.githubusercontent.com/MAlexVR/DrawPen-Classroom/main/assets/build/icon.ico',
        loadingGif: path.join(rootDir, 'assets/build/loading.gif'),
        name: 'DrawPenClassroom',
        authors: 'Dmytro Vasin and DrawPen Classroom contributors',
        description: 'Unofficial DrawPen classroom edition with additional teaching tools',
        shortcutName: 'DrawPen Classroom',
        setupExe: 'DrawPen-Classroom-Windows-x64.Setup.exe',
        noMsi: true
      }
    },
    {
      name: "@electron-forge/maker-deb",
      config: {
        options: {
          icon: linuxIconPng,
          categories: ['Graphics', 'Utility'],
          maintainer: "Mauricio Vargas",
          homepage: 'https://github.com/MAlexVR/DrawPen-Classroom'
        }
      }
    },
    {
      name: "@electron-forge/maker-rpm",
      config: {
        options: {
          icon: linuxIconPng,
          categories: ['Graphics'],
          homepage: 'https://github.com/MAlexVR/DrawPen-Classroom',
          execArguments: ['--ozone-platform=x11', '--force-device-scale-factor=1'],
        }
      }
    },
    {
      // Second RPM: forces X11 via Exec args in generated .desktop
      name: "@electron-forge/maker-rpm",
      config: {
        options: {
          name: "drawpen-x11",
          productName: "DrawPen (X11)",
          icon: linuxIconPng,
          categories: ['Graphics', 'Utility'],
          homepage: 'https://github.com/MAlexVR/DrawPen-Classroom',
          execArguments: ['--ozone-platform=x11'],
        }
      }
    },
    {
      // Second DEB: forces X11 via custom .desktop template
      name: "@electron-forge/maker-deb",
      config: {
        options: {
          name: "drawpen-x11",
          productName: "DrawPen (X11)",
          icon: linuxIconPng,
          categories: ['Graphics', 'Utility'],
          maintainer: "Mauricio Vargas",
          homepage: 'https://github.com/MAlexVR/DrawPen-Classroom',
          desktopTemplate: path.join(rootDir, 'assets/build/desktop-x11.desktop.ejs'),
        }
      }
    },
    {
      name: "@electron-forge/maker-zip",
      platforms: ["darwin", "linux", "win32"]
    }
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-webpack',
      config: {
        devContentSecurityPolicy: `default-src 'self' 'unsafe-inline' data:; script-src 'self' 'unsafe-inline' data:`,
        mainConfig: path.join(rootDir, 'tools/webpack/main.js'),
        renderer: {
          config: path.join(rootDir, 'tools/webpack/renderer.js'),
          entryPoints: [
            {
              name: 'app_window',
              html: path.join(rootDir, 'src/renderer/app_page/index.html'),
              js: path.join(rootDir, 'src/renderer/app_page/index.js'),
              preload: {
                js: path.join(rootDir, 'src/renderer/app_page/preload.js'),
              },
            },
            {
              name: 'extended_toolbar_window',
              html: path.join(rootDir, 'src/renderer/extended_toolbar_page/index.html'),
              js: path.join(rootDir, 'src/renderer/extended_toolbar_page/index.js'),
              preload: {
                js: path.join(rootDir, 'src/renderer/extended_toolbar_page/preload.js'),
              },
            },
            {
              name: 'about_window',
              html: path.join(rootDir, 'src/renderer/about_page/index.html'),
              js: path.join(rootDir, 'src/renderer/about_page/index.js'),
              preload: {
                js: path.join(rootDir, 'src/renderer/about_page/preload.js'),
              },
            },
            {
              name: 'settings_window',
              html: path.join(rootDir, 'src/renderer/settings_page/index.html'),
              js: path.join(rootDir, 'src/renderer/settings_page/index.js'),
              preload: {
                js: path.join(rootDir, 'src/renderer/settings_page/preload.js'),
              },
            },
          ]
        },
        devServer: {
          liveReload: false,
        },
      }
    }
  ],
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        // packageJson.author.name/productName are the upstream project's
        // ("DmytroVasin"/"DrawPen"), not this fork's — using them here
        // pointed every release at DmytroVasin/DrawPen instead of this
        // repo, so the workflow's own GITHUB_TOKEN had no access to it
        // and every publish failed with "Resource not accessible by
        // integration" regardless of this repo's own permissions.
        repository: {
          owner: 'MAlexVR',
          name: 'DrawPen-Classroom',
        },
        draft: true
      }
    }
  ]
};
