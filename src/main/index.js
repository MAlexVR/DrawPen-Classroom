import { app, Tray, Menu, BrowserWindow, screen, globalShortcut, shell, ipcMain, nativeTheme, systemPreferences, desktopCapturer, autoUpdater } from 'electron';
import { updateElectronApp } from 'update-electron-app';
import Store from 'electron-store';
import { randomUUID } from 'crypto';
import { spawn } from 'child_process';
import { PostHog } from 'posthog-node'
import fs from 'fs';
import path from 'path';
import os from 'os';
import electronSquirrelStartup from 'electron-squirrel-startup';

if (electronSquirrelStartup) {
  app.quit();
}

const isDevelopment = process.env.NODE_ENV === 'development'
const isDebugLoggingEnabled = process.env.DRAWPEN_DEBUG === '1'
const isLoggingEnabled = isDevelopment || isDebugLoggingEnabled

const isMac = process.platform === 'darwin'
const isLinux = process.platform === 'linux'
const isWin = process.platform === 'win32'
// Gates the X11 input-shape/window workarounds (XShape extension, X11
// positioning quirks) this fork needs whenever Electron is actually running
// through Ozone's X11 backend — true under any desktop launched with
// --ozone-platform=x11 (COSMIC, GNOME, etc.), not tied to one desktop.
// XDG_SESSION_TYPE would be wrong here: it reports the *session's* compositor
// (wayland even when this process itself runs under XWayland), not this
// process's actual Ozone backend.
const isX11 = isLinux && app.commandLine.getSwitchValue('ozone-platform') === 'x11'

// The "contained toolbar" architecture (a fixed, full-screen, invisible
// container window that never moves, with the visible toolbar positioned by
// CSS/DOM inside it) sidesteps a real Wayland limitation: clients can't
// reliably query or set their own absolute screen position there, so the
// alternative — a small window the OS is asked to move around — silently
// fails (getBounds() keeps reporting {x:0, y:0}), which broke the toolbar's
// position sync between Pointer and Draw Mode under native Wayland. Since
// the container's own position never changes, this works equally well under
// X11 and native Wayland, so it's used for all of Linux — not just isX11.
// The X11-only XShape input-shape helper below is a separate, additional
// precision refinement layered on top, not part of this positioning switch.
const usesContainedToolbar = isLinux

if (isWin) {
  // Keep this community build separate from the official DrawPen shortcut,
  // taskbar identity, and per-user settings directory.
  app.setName('DrawPen Classroom')
  app.setAppUserModelId('io.github.malexvr.drawpenclassroom')
}

// The renderer handshake now measures the mapped draw window before applying
// the toolbar position. The old COSMIC-specific correction would therefore be
// applied twice and move Draw Mode 16 px above Pointer Mode.
const TOOLBAR_WINDOW_CONTENT_OFFSET_Y = 0

const KEY_SHOW_HIDE_APP        = 'CmdOrCtrl+Shift+A'
const KEY_SHOW_HIDE_TOOLBAR    = 'CmdOrCtrl+T'
const KEY_SHOW_HIDE_WHITEBOARD = 'CmdOrCtrl+E'
const KEY_CLEAR_DESK           = 'CmdOrCtrl+K'
const KEY_SETTINGS             = 'CmdOrCtrl+,'
const KEY_MAKE_SCREENSHOT      = 'CmdOrCtrl+Shift+P'
const KEY_Q                    = 'CmdOrCtrl+Q'
const KEY_NULL                 = '[NULL]'

const EXTENDED_TOOLBAR_WINDOW_MARGIN = 10
const EXTENDED_TOOLBAR_WINDOW_WIDTH  = EXTENDED_TOOLBAR_WINDOW_MARGIN+80+17+5
const EXTENDED_TOOLBAR_WINDOW_HEIGHT = EXTENDED_TOOLBAR_WINDOW_MARGIN+70+5

let lastShortcutTime = 0;
const throttleDelay = 250;
const updateStoreDelay = 300;

const schema = {
  user_id: {
    type: 'string',
    default: randomUUID()
  },
  show_whiteboard: {
    type: 'boolean',
    default: false
  },
  whiteboard_color: {
    type: 'string',
    default: 'white'
  },
  whiteboard_layout: {
    type: 'object',
    default: {
      x: 5,
      y: 5,
      width: 90,
      height: 90,
    }
  },
  whiteboard_opacity: {
    type: 'number',
    default: 100
  },
  whiteboard_style: {
    type: 'string',
    default: 'dots'
  },
  whiteboard_spacing: {
    type: 'number',
    default: 40
  },
  show_tool_bar: {
    type: 'boolean',
    default: true
  },
  disable_toolbar_in_pointer_mode: {
    type: 'boolean',
    default: false
  },
  tool_bar_x: {
    type: 'number',
    default: 5
  },
  tool_bar_y: {
    type: 'number',
    default: 5
  },
  tool_bar_active_tool: {
    type: 'string',
    default: 'pen'
  },
  tool_bar_active_color_index: {
    type: 'number',
    default: 1
  },
  tool_bar_color_palette: {
    type: 'object',
    default: {
      color_1: '#529BE0',
      color_2: '#E05252',
      color_3: '#52E06C',
      color_4: '#E0A552',
      color_5: '#FFFFFF',
      color_6: '#1E1E1E',
      color_custom: '#FF00FF',
    }
  },
  tool_bar_active_weight_index: {
    type: 'number',
    default: 1
  },
  tool_bar_brush_size: {
    type: 'number',
    minimum: 2,
    maximum: 32,
    default: 8
  },
  table_rows: {
    type: 'number',
    minimum: 1,
    maximum: 20,
    default: 3
  },
  table_columns: {
    type: 'number',
    minimum: 1,
    maximum: 20,
    default: 3
  },
  number_line_min: {
    type: 'number',
    minimum: -50,
    maximum: 49,
    default: -5
  },
  number_line_max: {
    type: 'number',
    minimum: -49,
    maximum: 50,
    default: 5
  },
  tool_bar_default_brush: {
    type: 'string',
    default: 'pen'
  },
  tool_bar_default_figure: {
    type: 'string',
    default: 'arrow'
  },
  tool_bar_collapsed: {
    type: 'boolean',
    default: false
  },
  active_monitor_id: { // show on what monitor we renderED draw window last time
    type: 'number',
  },
  show_drawing_border: {
    type: 'boolean',
    default: true
  },
  show_cute_cursor: {
    type: 'boolean',
    default: true
  },
  pen_smoothing: {
    type: 'boolean',
    default: true
  },
  app_icon_color: {
    type: 'string',
    default: 'default'
  },
  launch_on_login: {
    type: 'boolean',
    default: false
  },
  key_binding_show_hide_app: {
    type: 'string',
    default: KEY_SHOW_HIDE_APP
  },
  key_binding_show_hide_toolbar: {
    type: 'string',
    default: KEY_SHOW_HIDE_TOOLBAR
  },
  key_binding_show_hide_whiteboard: {
    type: 'string',
    default: KEY_SHOW_HIDE_WHITEBOARD
  },
  key_binding_clear_desk: {
    type: 'string',
    default: KEY_CLEAR_DESK
  },
  fade_disappear_after_ms: {
    type: 'number',
    default: 1500
  },
  fade_out_duration_time_ms: {
    type: 'number',
    default: 1000
  },
  laser_time: {
    type: 'number',
    default: 2000
  },
  swap_colors_indexes: {
    type: 'array',
    default: [1, 2]
  },
  starts_hidden: {
    type: 'boolean',
    default: false
  },
  clear_drawings_on_hide: {
    type: 'boolean',
    default: false
  },
  drawing_monitor: {
    type: 'object',
    default: {
      mode: 'auto', // auto | fixed
      display_id: null,
      label: null,
    }
  },
};

// rawLog('[STORE PATH]:', app.getPath('userData') + '/config.json');
const store = new Store({
  schema
});

// electron-store preserves existing nested objects verbatim when a new color
// slot is introduced, so seed the custom slot for users upgrading in place.
if (!store.has('tool_bar_color_palette.color_custom')) {
  store.set('tool_bar_color_palette.color_custom', '#FF00FF')
}

const storedWhiteboardLayout = store.get('whiteboard_layout')
if (
  storedWhiteboardLayout?.x === 10 &&
  storedWhiteboardLayout?.y === 10 &&
  storedWhiteboardLayout?.width === 80 &&
  storedWhiteboardLayout?.height === 80
) {
  store.set('whiteboard_layout', { x: 5, y: 5, width: 90, height: 90 })
}

store.onDidChange('show_tool_bar', (newValue, oldValue) => {
  updateExternalToolbarVisibility()
  updateContextMenu()
})
store.onDidChange('show_whiteboard', (newValue, oldValue) => {
  updateContextMenu()
})

if (isLoggingEnabled) {
  rawLog('Initial store: ', store.store)

  store.onDidAnyChange((newStore, _oldStore) => {
    rawLog('Updated store: ', newStore)
  })
}

let tray
let mainWindow
let extendedToolbarWindow
let aboutWindow
let settingsWindow

let isQuitting = false
let startAsHidden = false
let drawingMode = false
let toolbarTransitionInProgress = false
let toolbarTransitionPromise = null
let revealRequestedAfterTransition = false
let toolbarTransitionGeneration = 0
let mainWindowLoaded = false
let extendedToolbarWindowLoaded = false
let appReadyAt = null

const drawToolbarGeometryWaiters = new Map()
const drawToolbarAppliedWaiters = new Map()
const extendedToolbarConcealedWaiters = new Map()

let extendedToolbarPositionStoreTimeout = null
let extendedToolbarProgrammaticMoveTimeout = null
let ignoreExtendedToolbarMoveEvents = false
let containedToolbarInputShapeHelper = null
let lastContainedToolbarPosition = null
let containedToolbarInputShapeSettleTimeout = null

function waitForTransitionSignal(waiters, token, label) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      waiters.delete(token)
      reject(new Error(`Timed out waiting for ${label}`))
    }, 3000)

    waiters.set(token, {
      resolve: (payload) => {
        clearTimeout(timeout)
        resolve(payload)
      },
    })
  })
}

function resolveTransitionSignal(waiters, token, payload) {
  const waiter = waiters.get(token)
  if (!waiter) return;

  waiters.delete(token)
  waiter.resolve(payload)
}

function waitForMainWindowLoad() {
  if (mainWindowLoaded && !mainWindow.webContents.isLoading()) {
    return Promise.resolve()
  }

  return new Promise(resolve => mainWindow.webContents.once('did-finish-load', resolve))
}

function waitForExtendedToolbarWindowLoad() {
  if (extendedToolbarWindowLoaded && !extendedToolbarWindow.webContents.isLoading()) {
    return Promise.resolve()
  }

  return new Promise(resolve => extendedToolbarWindow.webContents.once('did-finish-load', resolve))
}

ipcMain.on('draw_toolbar_geometry_ready', (event, token, geometry) => {
  if (event.sender !== mainWindow?.webContents) return;
  resolveTransitionSignal(drawToolbarGeometryWaiters, token, geometry)
})

ipcMain.on('draw_toolbar_position_applied', (event, token, geometry) => {
  if (event.sender !== mainWindow?.webContents) return;
  resolveTransitionSignal(drawToolbarAppliedWaiters, token, geometry)
})

ipcMain.on('extended_toolbar_concealed', (event, token, concealed) => {
  if (event.sender !== extendedToolbarWindow?.webContents) return;
  resolveTransitionSignal(extendedToolbarConcealedWaiters, token, concealed)
})

ipcMain.on('move_contained_toolbar', (event, position, finished) => {
  if (!usesContainedToolbar || event.sender !== extendedToolbarWindow?.webContents) return;
  if (!Number.isFinite(position?.x) || !Number.isFinite(position?.y)) return;

  applyContainedToolbarPosition(position, { storePosition: Boolean(finished) })
})

const iconSrc = {
  WHITE:           path.resolve(__dirname, '../renderer/assets/trayIconWhite.png'),
  BLACK:           path.resolve(__dirname, '../renderer/assets/trayIconBlack.png'),
  DARWIN_TEMPLATE: path.resolve(__dirname, '../renderer/assets/trayIconTemplate@2x.png'),
}

function getTrayIconPath() {
  if (isMac) return iconSrc.DARWIN_TEMPLATE

  const appIconColor = store.get('app_icon_color')

  if (appIconColor === 'white') return iconSrc.WHITE
  if (appIconColor === 'black') return iconSrc.BLACK

  if (isWin && nativeTheme.shouldUseDarkColors) return iconSrc.WHITE
  if (isWin) return iconSrc.BLACK

  if (isLinux) return iconSrc.WHITE

  return iconSrc.BLACK
}

function updateContextMenu() {
  rawLog('Updating context menu...')

  if (!tray) return;

  const show_tool_bar   = store.get('show_tool_bar')
  const show_whiteboard = store.get('show_whiteboard')

  const key_show_hide_app        = store.get('key_binding_show_hide_app')
  const key_show_hide_toolbar    = store.get('key_binding_show_hide_toolbar')
  const key_show_hide_whiteboard = store.get('key_binding_show_hide_whiteboard')
  const key_clear_desk           = store.get('key_binding_clear_desk')

  const accelForTray = (accel) => {
    if (!accel) return undefined;
    if (accel === KEY_NULL) return undefined;

    if (isLinux) return undefined; // Disable tray menu accelerators on Linux

    return accel
  };

  const withAccelHint = (label, accel) => {
    if (!accel) return label;
    if (accel === KEY_NULL) return label;

    if (isLinux) {
      return `${label} (${normalizeAcceleratorForUI(accel)})`;
    }

    return label;
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: withAccelHint((drawingMode ? 'Enable Pointer Mode' : 'Enable Draw Mode'), key_show_hide_app),
      accelerator: accelForTray(key_show_hide_app),
      click: toggleDrawOrPointerMode
    },
    {
      label: withAccelHint((show_tool_bar ? 'Hide Toolbar' : 'Show Toolbar'), key_show_hide_toolbar),
      accelerator: accelForTray(key_show_hide_toolbar),
      click: toggleToolbar
    },
    {
      label: withAccelHint((show_whiteboard ? 'Hide Whiteboard' : 'Show Whiteboard'), key_show_hide_whiteboard),
      accelerator: accelForTray(key_show_hide_whiteboard),
      click: toggleWhiteboard
    },
    {
      label: withAccelHint('Clear desk', key_clear_desk),
      accelerator: accelForTray(key_clear_desk),
      click: resetScreen
    },
    { type: 'separator' },
    {
      label: 'Reset to original',
      click: resetApp
    },
    {
      label: withAccelHint('Settings', KEY_SETTINGS),
      accelerator: accelForTray(KEY_SETTINGS),
      click: showSettingsWindow
    },
    { type: 'separator' },
    {
      label: 'Capture Screen (Beta)',
      accelerator: accelForTray(KEY_MAKE_SCREENSHOT),
      click: makeScreenshot
    },
    { type: 'separator' },
    {
      label: 'About DrawPen',
      click: showAboutWindow
    },
    {
      label: withAccelHint('Quit', KEY_Q),
      accelerator: accelForTray(KEY_Q),
      click: quitApp
    }
  ]);

  tray.setContextMenu(contextMenu);
}

function registerTrayActions() {
  nativeTheme.on('updated', () => {
    if (!tray) return;

    tray.setImage(getTrayIconPath())
  })

  if (isWin || isLinux) {
    tray.on('click', () => {
      toggleDrawOrPointerMode()
    })
  }
}

function createMainWindow() {
  const currentDisplay = getLockedMonitor() || getActiveMonitor() || getUnderCursorMonitor()

  if (store.get('active_monitor_id') !== currentDisplay.id) {
    store.set('active_monitor_id', currentDisplay.id)
  }

  let { x: displayX, y: displayY, width: displayWidth, height: displayHeight } = currentDisplay.workArea

  let isResizable = false
  let hasDevTools = false

  if (isDevelopment) {
    displayWidth = 500
    displayHeight = 500
    isResizable = true
    hasDevTools = true
  }

  mainWindow = new BrowserWindow({
    show: false,
    x: displayX,
    y: displayY,
    width: displayWidth,
    height: displayHeight,
    transparent: true,
    backgroundColor: '#00000000', // 8-symbol ARGB
    resizable: isResizable,
    minimizable: false,
    maximizable: false,
    frame: false,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    opacity: 0.9999999, // Fix transparency rendering artifacts
    autoHideMenuBar: true,
    webPreferences: {
      devTools: hasDevTools,
      nodeIntegration: false,
      preload: APP_WINDOW_PRELOAD_WEBPACK_ENTRY,
    }
  })

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindowLoaded = true
  })
  mainWindow.loadURL(APP_WINDOW_WEBPACK_ENTRY);
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.setAlwaysOnTop(true)

  mainWindow.on('close', function (event) {
    rawLog('Main window: on close')

    if (isQuitting) return;

    event.preventDefault();

    hideApp()
  })

  mainWindow.on('closed', function () {
    mainWindow = null

    app.quit()
  })

  mainWindow.webContents.setVisualZoomLevelLimits(1, 1);
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if ((input.control || input.meta) && ['+', '=', '-', '0', 'numadd', 'numsub'].includes(input.key.toLowerCase())) {
      event.preventDefault();
    }
  });

  rawLog('Main Window:', currentDisplay.workArea)
}

function createExtendedToolbarWindow() {
  let hasDevTools = false

  const initialDisplay = getLockedMonitor() || getActiveMonitor() || getUnderCursorMonitor()
  const initialX = usesContainedToolbar
    ? initialDisplay.workArea.x
    : initialDisplay.workArea.x + store.get('tool_bar_x') - EXTENDED_TOOLBAR_WINDOW_MARGIN
  const initialY = usesContainedToolbar
    ? initialDisplay.workArea.y
    : initialDisplay.workArea.y + store.get('tool_bar_y') - EXTENDED_TOOLBAR_WINDOW_MARGIN
  const initialWidth = usesContainedToolbar ? initialDisplay.workArea.width : EXTENDED_TOOLBAR_WINDOW_WIDTH
  const initialHeight = usesContainedToolbar ? initialDisplay.workArea.height : EXTENDED_TOOLBAR_WINDOW_HEIGHT

  if (isDevelopment) {
    hasDevTools = true
  }

  extendedToolbarWindow = new BrowserWindow({
    show: false,
    x: initialX,
    y: initialY,
    width: initialWidth,
    height: initialHeight,
    transparent: true,
    backgroundColor: '#00000000', // 8-symbol ARGB
    resizable: false,
    minimizable: false,
    maximizable: false,
    frame: false,
    // All of Linux uses the contained-toolbar architecture now (see
    // usesContainedToolbar above), so the 'toolbar' X11 window-type hint
    // (with no Wayland equivalent) is never needed here anymore.
    type: undefined,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    opacity: 0.9999999, // Fix transparency rendering artifacts
    autoHideMenuBar: true,
    webPreferences: {
      devTools: hasDevTools,
      nodeIntegration: false,
      preload: EXTENDED_TOOLBAR_WINDOW_PRELOAD_WEBPACK_ENTRY,
    }
  })

  extendedToolbarWindow.webContents.on('did-finish-load', () => {
    extendedToolbarWindowLoaded = true
  })
  extendedToolbarWindow.loadURL(EXTENDED_TOOLBAR_WINDOW_WEBPACK_ENTRY)
  extendedToolbarWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  extendedToolbarWindow.setAlwaysOnTop(true)

  extendedToolbarWindow.on('close', function (event) {
    rawLog('Extended toolbar window: on close')

    if (isQuitting) return;

    event.preventDefault();

    hideApp()
  })

  extendedToolbarWindow.on('closed', () => {
    stopContainedToolbarInputShapeHelper()

    if (extendedToolbarPositionStoreTimeout) {
      clearTimeout(extendedToolbarPositionStoreTimeout)
      extendedToolbarPositionStoreTimeout = null
    }

    if (extendedToolbarProgrammaticMoveTimeout) {
      clearTimeout(extendedToolbarProgrammaticMoveTimeout)
      extendedToolbarProgrammaticMoveTimeout = null
    }

    ignoreExtendedToolbarMoveEvents = false

    extendedToolbarWindow = null

    app.quit()
  })

  extendedToolbarWindow.on('move', () => {
    if (usesContainedToolbar) return;

    if (ignoreExtendedToolbarMoveEvents) {
      if (extendedToolbarProgrammaticMoveTimeout) {
        clearTimeout(extendedToolbarProgrammaticMoveTimeout)
      }

      extendedToolbarProgrammaticMoveTimeout = setTimeout(() => {
        extendedToolbarProgrammaticMoveTimeout = null
        ignoreExtendedToolbarMoveEvents = false
      }, updateStoreDelay)

      return
    }

    scheduleStoreToolbarPositionFromExtendedWindow()
  })

  extendedToolbarWindow.webContents.on('did-finish-load', () => {
    if (startAsHidden) return;

    runToolbarTransition(showInitialPointerMode)
  })

  extendedToolbarWindow.webContents.setVisualZoomLevelLimits(1, 1);
  extendedToolbarWindow.webContents.on('before-input-event', (event, input) => {
    if ((input.control || input.meta) && ['+', '=', '-', '0', 'numadd', 'numsub'].includes(input.key.toLowerCase())) {
      event.preventDefault();
    }
  });
}

function showAboutWindow() {
  withThrottle(() => {
    if (aboutWindow) {
      aboutWindow.focus();
    } else {
      createAboutWindow();
    }

    if (drawingMode) {
      enablePointerMode()
    }
  });
}

function createAboutWindow() {
  let hasDevTools = false

  if (isDevelopment) {
    hasDevTools = true
  }

  aboutWindow = new BrowserWindow({
    show: false,
    width: 250,
    height: 250,
    resizable: false,
    minimizable: false,
    maximizable: false,
    autoHideMenuBar: true,
    webPreferences: {
      devTools: hasDevTools,
      nodeIntegration: false,
      preload: ABOUT_WINDOW_PRELOAD_WEBPACK_ENTRY,
    }
  })
  aboutWindow.center();

  aboutWindow.loadURL(ABOUT_WINDOW_WEBPACK_ENTRY)

  aboutWindow.on('minimize', (event) => {
    event.preventDefault()
  })

  aboutWindow.on('closed', () => {
    aboutWindow = null
  })

  aboutWindow.webContents.on('did-finish-load', () => {
    aboutWindow.show()
  })

  aboutWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);

    return { action: "deny" };
  })

  aboutWindow.webContents.setVisualZoomLevelLimits(1, 1);
  aboutWindow.webContents.on('before-input-event', (event, input) => {
    if ((input.control || input.meta) && ['+', '=', '-', '0', 'numadd', 'numsub'].includes(input.key.toLowerCase())) {
      event.preventDefault();
    }
  });
}

function showSettingsWindow() {
  withThrottle(() => {
    if (settingsWindow) {
      settingsWindow.focus();
    } else {
      createSettingsWindow();
    }

    if (drawingMode) {
      enablePointerMode()
    }
  });
}

function createSettingsWindow() {
  rawLog('Creating settings window...')

  let hasDevTools = false

  if (isDevelopment) {
    hasDevTools = true
  }

  settingsWindow = new BrowserWindow({
    show: false,
    width: 800,
    height: 600,
    resizable: false,
    minimizable: false,
    maximizable: false,
    autoHideMenuBar: true,
    webPreferences: {
      devTools: hasDevTools,
      nodeIntegration: false,
      preload: SETTINGS_WINDOW_PRELOAD_WEBPACK_ENTRY,
    }
  })
  settingsWindow.center();

  settingsWindow.loadURL(SETTINGS_WINDOW_WEBPACK_ENTRY)

  settingsWindow.on('minimize', (event) => {
    event.preventDefault()
  })

  settingsWindow.on('closed', () => {
    settingsWindow = null
  })

  settingsWindow.webContents.on('did-finish-load', () => {
    settingsWindow.show()
  })

  settingsWindow.webContents.setVisualZoomLevelLimits(1, 1);
  settingsWindow.webContents.on('before-input-event', (event, input) => {
    if ((input.control || input.meta) && ['+', '=', '-', '0', 'numadd', 'numsub'].includes(input.key.toLowerCase())) {
      event.preventDefault();
    }
  });
}

// Must be before "app.whenReady()"
if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0); // return is forbidden in this context
}

app.on('second-instance', () => {
  requestRevealExistingInstance()
});

app.commandLine.appendSwitch('disable-pinch');

app.whenReady().then(() => {
  appReadyAt = Date.now()

  launchTracker()

  hideDock()

  startAsHiddenCheck()

  logDisplays()

  createMainWindow()
  createExtendedToolbarWindow()

  tray = new Tray(getTrayIconPath())
  updateContextMenu()
  registerTrayActions()

  registerGlobalShortcuts()

  updateApp()
  setApplicationName()

  screen.on('display-added', handleDisplayChange)
  screen.on('display-removed', handleDisplayChange)
  screen.on('display-metrics-changed', handleDisplayChange)
})

app.on('before-quit', () => {
  isQuitting = true;
  flushExtendedToolbarPosition({ force: true })
});

autoUpdater.on('before-quit-for-update', () => {
  isQuitting = true;
});

app.on('will-quit', () => {
  rawLog('Will quit app... (Unregister all shortcuts)')

  unRegisterGlobalShortcuts()
});

app.on('window-all-closed', () => {
  rawLog('All windows closed.')

  app.quit()
})

function startAsHiddenCheck() {
  if (safeWasOpenedAtLogin()) {
    startAsHidden = true
    return
  }

  if (store.get('starts_hidden')) {
    startAsHidden = true
    return
  }
}

function hideDock() {
  if (isMac) {
    app.dock.hide();
  }
}

function updateApp() {
  if (isLinux) return

  updateElectronApp()
}

ipcMain.handle('get_app_version', () => {
  return app.getVersion();
});

ipcMain.handle('get_settings', () => {
  return {
    show_whiteboard: store.get('show_whiteboard'),
    whiteboard_color: store.get('whiteboard_color'),
    whiteboard_layout: store.get('whiteboard_layout'),
    whiteboard_opacity: store.get('whiteboard_opacity'),
    whiteboard_style: store.get('whiteboard_style'),
    whiteboard_spacing: store.get('whiteboard_spacing'),
    show_tool_bar: store.get('show_tool_bar'),
    show_drawing_border: store.get('show_drawing_border'),
    show_cute_cursor: store.get('show_cute_cursor'),
    pen_smoothing: store.get('pen_smoothing'),
    tool_bar_x: store.get('tool_bar_x'),
    tool_bar_y: store.get('tool_bar_y'),
    tool_bar_window_content_offset_y: TOOLBAR_WINDOW_CONTENT_OFFSET_Y,
    tool_bar_active_tool: store.get('tool_bar_active_tool'),
    tool_bar_active_color_index: store.get('tool_bar_active_color_index'),
    tool_bar_color_palette: store.get('tool_bar_color_palette'),
    tool_bar_active_weight_index: store.get('tool_bar_active_weight_index'),
    tool_bar_brush_size: store.get('tool_bar_brush_size'),
    table_rows: store.get('table_rows'),
    table_columns: store.get('table_columns'),
    number_line_min: store.get('number_line_min'),
    number_line_max: store.get('number_line_max'),
    tool_bar_default_brush: store.get('tool_bar_default_brush'),
    tool_bar_default_figure: store.get('tool_bar_default_figure'),
    tool_bar_collapsed: store.get('tool_bar_collapsed'),
    swap_colors_indexes: store.get('swap_colors_indexes'),
    fade_disappear_after_ms: store.get('fade_disappear_after_ms'),
    fade_out_duration_time_ms: store.get('fade_out_duration_time_ms'),
    laser_time: store.get('laser_time'),
    clear_drawings_on_hide: store.get('clear_drawings_on_hide'),

    key_binding_show_hide_toolbar:    normalizeAcceleratorForUI(store.get('key_binding_show_hide_toolbar')),
    key_binding_show_hide_whiteboard: normalizeAcceleratorForUI(store.get('key_binding_show_hide_whiteboard')),
    key_binding_clear_desk:           normalizeAcceleratorForUI(store.get('key_binding_clear_desk')),
    key_binding_open_settings:        normalizeAcceleratorForUI(KEY_SETTINGS),
    key_binding_make_screenshot:      normalizeAcceleratorForUI(KEY_MAKE_SCREENSHOT),
  };
});

ipcMain.handle('set_settings', (_event, newSettings) => {
  rawLog('Updating settings from Renderer:')

  const {
    tool_bar_x,
    tool_bar_y,
    tool_bar_screen_x,
    tool_bar_screen_y,
    ...rendererSettings
  } = newSettings

  // Coordinates are deliberately excluded: renderer initialization and
  // ResizeObserver effects run while the window is hidden. Only explicit
  // user movement and mode transitions may update the canonical position.
  store.set({ ...store.store, ...rendererSettings })

  return null
});

ipcMain.handle('close_app', () => {
  hideApp();

  return null
});

function storeToolbarScreenPosition(toolbarScreenPosition) {
  if (
    !toolbarScreenPosition ||
    !Number.isFinite(toolbarScreenPosition.x) ||
    !Number.isFinite(toolbarScreenPosition.y)
  ) return;

  const toolbarDisplay = screen.getDisplayNearestPoint({
    x: Math.round(toolbarScreenPosition.x),
    y: Math.round(toolbarScreenPosition.y),
  })

  store.set({
    tool_bar_x: Math.round(toolbarScreenPosition.x - toolbarDisplay.workArea.x),
    tool_bar_y: Math.round(toolbarScreenPosition.y - toolbarDisplay.workArea.y),
  })
}

ipcMain.handle('set_toolbar_position_from_draw_mode', (_event, toolbarScreenPosition) => {
  if (drawingMode && !toolbarTransitionInProgress) {
    storeToolbarScreenPosition(toolbarScreenPosition)
  }

  return null
});

ipcMain.handle('toggle_draw_or_pointer_window', (_event, toolbarScreenPosition) => {
  toggleDrawOrPointerMode(toolbarScreenPosition)

  return null
});

ipcMain.handle('open_settings', () => {
  showSettingsWindow()

  return null
});

ipcMain.handle('make_screenshot', async () => {
  await makeScreenshot()

  return null
});

ipcMain.handle('open_notification', (_event, info) => {
  if (info.action === 'open_screenshot') {
    enablePointerMode()

    const screenshotsDirectory = path.join(app.getPath('pictures'), 'Screenshots')
    const filePath = path.isAbsolute(info.data)
      ? info.data
      : path.join(screenshotsDirectory, info.data)

    if (fs.existsSync(filePath)) {
      shell.showItemInFolder(filePath)
    } else {
      shell.openPath(screenshotsDirectory)
    }

    return null
  }

  if (info.action === 'open_security_preferences') {
    enablePointerMode()

    if (isMac) {
      shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture');
    }

    return null
  }
});

ipcMain.handle('reset_to_originals', () => {
  resetApp();

  return null
});

ipcMain.handle('get_configuration', () => {
  rawLog('Getting configuration...')

  return {
    app_version:                              app.getVersion(),

    show_drawing_border:                      store.get('show_drawing_border'),
    show_cute_cursor:                         store.get('show_cute_cursor'),
    pen_smoothing:                            store.get('pen_smoothing'),
    tool_bar_color_palette:                   store.get('tool_bar_color_palette'),
    swap_colors_indexes:                      store.get('swap_colors_indexes'),
    fade_disappear_after_ms:                  store.get('fade_disappear_after_ms'),
    fade_out_duration_time_ms:                store.get('fade_out_duration_time_ms'),
    laser_time:                               store.get('laser_time'),

    displays:                                 getAllDisplaysInfo(),
    drawing_monitor:                          store.get('drawing_monitor'),
    app_icon_color:                           store.get('app_icon_color'),
    launch_on_login:                          store.get('launch_on_login'),
    starts_hidden:                            store.get('starts_hidden'),
    clear_drawings_on_hide:                   store.get('clear_drawings_on_hide'),
    disable_toolbar_in_pointer_mode:          store.get('disable_toolbar_in_pointer_mode'),

    key_binding_show_hide_app:                normalizeAcceleratorForUI(store.get('key_binding_show_hide_app')),
    key_binding_show_hide_app_default:        normalizeAcceleratorForUI(schema.key_binding_show_hide_app.default),

    key_binding_show_hide_toolbar:            normalizeAcceleratorForUI(store.get('key_binding_show_hide_toolbar')),
    key_binding_show_hide_toolbar_default:    normalizeAcceleratorForUI(schema.key_binding_show_hide_toolbar.default),

    key_binding_show_hide_whiteboard:         normalizeAcceleratorForUI(store.get('key_binding_show_hide_whiteboard')),
    key_binding_show_hide_whiteboard_default: normalizeAcceleratorForUI(schema.key_binding_show_hide_whiteboard.default),

    key_binding_clear_desk:                   normalizeAcceleratorForUI(store.get('key_binding_clear_desk')),
    key_binding_clear_desk_default:           normalizeAcceleratorForUI(schema.key_binding_clear_desk.default),
  };
});

ipcMain.handle('can_register_shortcut', async (_event, value) => {
  rawLog('Checking shortcut registration:', value)

  const accelerator = deNormalizeAcceleratorFromUI(value)

  const shortcutsInUse = [
    store.get('key_binding_show_hide_app'),
    store.get('key_binding_show_hide_toolbar'),
    store.get('key_binding_show_hide_whiteboard'),
    store.get('key_binding_clear_desk'),
  ].filter(s => s && s !== KEY_NULL)

  if (shortcutsInUse.includes(accelerator)) {
    return false;
  }

  if (globalShortcut.isRegistered(accelerator)) {
    return false;
  }

  try {
    const success = globalShortcut.register(accelerator, () => {});
    if (success) {
      globalShortcut.unregister(accelerator);
    }

    return success;
  } catch {
    return false;
  }
});

ipcMain.handle('set_shortcut', (_event, key, value) => {
  rawLog('Setting shortcut:', key, value)
  const accelerator = deNormalizeAcceleratorFromUI(value)

  unRegisterGlobalShortcuts()

  if (accelerator) {
    store.set(key, accelerator)
  } else {
    store.delete(key)
  }

  registerGlobalShortcuts();
  updateContextMenu()

  mainWindow.reload()

  return null
});

ipcMain.handle('set_launch_on_login', (_event, value) => {
  rawLog('Setting launch on login:', value)

  safeSetLoginItemSettings({ openAtLogin: value });

  store.set('launch_on_login', value)

  return null;
});

ipcMain.handle('set_starts_hidden', (_event, value) => {
  rawLog('Setting starts hidden:', value)

  store.set('starts_hidden', value)

  return null;
});

ipcMain.handle('set_clear_drawings_on_hide', (_event, value) => {
  rawLog('Setting clear drawings on hide:', value)

  store.set('clear_drawings_on_hide', value)

  refreshSettingsInRenderer();

  return null;
});

ipcMain.handle('set_show_drawing_border', (_event, value) => {
  rawLog('Setting drawing border:', value)

  store.set('show_drawing_border', value)

  refreshSettingsInRenderer();

  return null;
});

ipcMain.handle('set_show_cute_cursor', (_event, value) => {
  rawLog('Setting cute cursor:', value)

  store.set('show_cute_cursor', value)

  refreshSettingsInRenderer();

  return null;
});

ipcMain.handle('set_pen_smoothing', (_event, value) => {
  rawLog('Setting pen smoothing:', value)

  store.set('pen_smoothing', value)

  refreshSettingsInRenderer();

  return null;
});

ipcMain.handle('set_swap_colors', (_event, value) => {
  rawLog('Setting swap colors:', value)

  store.set('swap_colors_indexes', value)

  refreshSettingsInRenderer();

  return null;
});

ipcMain.handle('set_toolbar_color', (_event, colorId, normalizedColor) => {
  rawLog('Setting toolbar color:', colorId, normalizedColor)

  store.set(`tool_bar_color_palette.${colorId}`, normalizedColor)

  refreshSettingsInRenderer();

  return null
});

ipcMain.handle('set_fade_disappear_after_ms', (_event, value) => {
  rawLog('Setting fade disappear after:', value)

  store.set('fade_disappear_after_ms', value)

  mainWindow.reload()

  return null
});

ipcMain.handle('set_fade_out_duration_time_ms', (_event, value) => {
  rawLog('Setting fade out duration time:', value)

  store.set('fade_out_duration_time_ms', value)

  mainWindow.reload()

  return null
});

ipcMain.handle('set_laser_time', (_event, value) => {
  rawLog('Setting laser time:', value)

  store.set('laser_time', value)

  mainWindow.reload()

  return null
});

ipcMain.handle('set_app_icon_color', (_event, value) => {
  rawLog('Setting app icon color:', value)

  store.set('app_icon_color', value)

  tray.setImage(getTrayIconPath())
  return null;
});

ipcMain.handle('set_drawing_monitor', (_event, value) => {
  rawLog('Setting drawing monitor:', value)

  store.set('drawing_monitor', value)

  return null
});

ipcMain.handle('set_disable_toolbar_in_pointer_mode', (_event, value) => {
  rawLog('Setting disable toolbar in pointer mode:', value)

  store.set('disable_toolbar_in_pointer_mode', value)

  updateExternalToolbarVisibility()

  return null
});

function refreshSettingsInRenderer() {
  mainWindow.webContents.send('refresh_settings', {
    whiteboard_color:        store.get('whiteboard_color'),
    whiteboard_layout:       store.get('whiteboard_layout'),
    whiteboard_opacity:      store.get('whiteboard_opacity'),
    whiteboard_style:        store.get('whiteboard_style'),
    whiteboard_spacing:      store.get('whiteboard_spacing'),
    show_drawing_border:     store.get('show_drawing_border'),
    show_cute_cursor:        store.get('show_cute_cursor'),
    pen_smoothing:           store.get('pen_smoothing'),
    tool_bar_brush_size:     store.get('tool_bar_brush_size'),
    table_rows:              store.get('table_rows'),
    table_columns:           store.get('table_columns'),
    number_line_min:         store.get('number_line_min'),
    number_line_max:         store.get('number_line_max'),
    tool_bar_color_palette:  store.get('tool_bar_color_palette'),
    swap_colors_indexes:     store.get('swap_colors_indexes'),
    clear_drawings_on_hide:  store.get('clear_drawings_on_hide'),
  })
}

function updateToolbarPositionInRenderer() {
  const toolbarDisplay = getLockedMonitor() || getActiveMonitor() || getUnderCursorMonitor()

  mainWindow.webContents.send('update_toolbar_position', {
    tool_bar_screen_x: toolbarDisplay.workArea.x + store.get('tool_bar_x'),
    tool_bar_screen_y: toolbarDisplay.workArea.y + store.get('tool_bar_y'),
    tool_bar_window_content_offset_y: TOOLBAR_WINDOW_CONTENT_OFFSET_Y,
  })
}

function registerGlobalShortcuts() {
  rawLog('REGISTER global shortcuts...')

  const keyApp = store.get('key_binding_show_hide_app')
  safeRegisterGlobalShortcut(keyApp, toggleDrawOrPointerMode)
}

function unRegisterGlobalShortcuts() {
  rawLog('UNREGISTER global shortcuts...')

  globalShortcut.unregisterAll();
}

function withThrottle(callback) {
  rawLog('withThrottle called...')

  const now = Date.now();
  if (now < lastShortcutTime + throttleDelay) return;
  lastShortcutTime = now;

  callback();
}

function toggleDrawOrPointerMode(toolbarScreenPosition = null) {
  withThrottle(() => {
    rawLog('Toggling draw mode...')
    runToolbarTransition(() => drawingMode
      ? enablePointerMode(toolbarScreenPosition)
      : enableDrawMode())
  });
}

function runToolbarTransition(operation) {
  if (toolbarTransitionInProgress) return toolbarTransitionPromise;

  toolbarTransitionInProgress = true
  toolbarTransitionPromise = Promise.resolve()
    .then(operation)
    .catch(error => rawLog('Toolbar transition failed:', error))
    .finally(() => {
      toolbarTransitionInProgress = false
      toolbarTransitionPromise = null

      if (revealRequestedAfterTransition) {
        revealRequestedAfterTransition = false
        revealExistingInstance()
      }
    })

  return toolbarTransitionPromise
}

function requestRevealExistingInstance() {
  if (!mainWindow || !extendedToolbarWindow) return;

  if (toolbarTransitionInProgress) {
    revealRequestedAfterTransition = true
    return
  }

  revealExistingInstance()
}

function revealExistingInstance() {
  if (drawingMode) {
    showWindow(mainWindow)
    return
  }

  if (extendedToolbarWindow.isVisible()) {
    extendedToolbarWindow.moveTop()
    return
  }

  runToolbarTransition(showInitialPointerMode)
}

async function enableDrawMode() {
  rawLog('Enable drawing mode...')

  const token = ++toolbarTransitionGeneration
  const currentDisplay = getLockedMonitor() || getUnderToolbarMonitor() || getUnderCursorMonitor()

  flushExtendedToolbarPosition()

  try {
    await setExtendedToolbarConcealed(true, token)

    updateMainWindowPosition(currentDisplay)
    await waitForMainWindowLoad()

    const geometryReady = waitForTransitionSignal(
      drawToolbarGeometryWaiters,
      token,
      'Draw toolbar geometry',
    )

    mainWindow.webContents.send('prepare_draw_toolbar', token)
    showWindow(mainWindow)

    const geometry = await geometryReady
    rawLog('Draw toolbar geometry ready:', geometry)

    const positionApplied = waitForTransitionSignal(
      drawToolbarAppliedWaiters,
      token,
      'Draw toolbar position',
    )

    mainWindow.webContents.send('apply_draw_toolbar_position', token, {
      screen_x: currentDisplay.workArea.x + store.get('tool_bar_x'),
      screen_y: currentDisplay.workArea.y + store.get('tool_bar_y'),
      window_content_offset_y: TOOLBAR_WINDOW_CONTENT_OFFSET_Y,
    })

    const appliedGeometry = await positionApplied
    rawLog('Draw toolbar position applied:', appliedGeometry)

    drawingMode = true
    updateContextMenu()
  } catch (error) {
    hideWindow(mainWindow)
    await setExtendedToolbarConcealed(false, token).catch(() => {})
    drawingMode = false
    updateContextMenu()
    throw error
  }
}

async function enablePointerMode(toolbarScreenPosition = null) {
  rawLog('Enable pointer mode...')

  if (!drawingMode) {
    await showInitialPointerMode()
    return
  }

  const token = ++toolbarTransitionGeneration

  if (toolbarScreenPosition) {
    storeToolbarScreenPosition(toolbarScreenPosition)
  }

  resetScreenOnHide()

  try {
    await waitForMainWindowLoad()

    const drawToolbarConcealed = waitForTransitionSignal(
      drawToolbarGeometryWaiters,
      token,
      'Draw toolbar concealment',
    )

    mainWindow.webContents.send('prepare_draw_toolbar', token)
    await drawToolbarConcealed

    const currentDisplay = getLockedMonitor() || getActiveMonitor() || getUnderCursorMonitor()
    const requestedBounds = updateExtendedToolbarWindowPosition(currentDisplay)
    const settledBounds = await waitForExtendedToolbarBoundsToSettle(requestedBounds)

    if (usesContainedToolbar) {
      configureContainedToolbar(currentDisplay, settledBounds)
    }

    showWindow(extendedToolbarWindow, { inactive: true })
    extendedToolbarWindow.moveTop()
    await setExtendedToolbarConcealed(false, token)
    hideWindow(mainWindow)

    drawingMode = false
    updateContextMenu()

    releaseFocusBack()
  } catch (error) {
    await setExtendedToolbarConcealed(true, token).catch(() => {})
    showWindow(mainWindow)
    drawingMode = true
    updateContextMenu()
    throw error
  }
}

async function showInitialPointerMode() {
  rawLog('Enable pointer mode...')

  const token = ++toolbarTransitionGeneration

  resetScreenOnHide()

  extendedToolbarWindow.setIgnoreMouseEvents(true)

  const currentDisplay = getLockedMonitor() || getActiveMonitor() || getUnderCursorMonitor()
  const requestedBounds = updateExtendedToolbarWindowPosition(currentDisplay)
  showWindow(extendedToolbarWindow, { inactive: true })
  const settledBounds = await waitForExtendedToolbarBoundsToSettle(requestedBounds)

  if (usesContainedToolbar) {
    configureContainedToolbar(currentDisplay, settledBounds)
  }

  // If the compositor insists on another initial placement, make that real
  // position authoritative before the first mode switch. This prevents the
  // first Draw Mode transition from jumping to stale stored coordinates.
  // (Only relevant off the contained-toolbar path, i.e. macOS/Windows.)
  if (!usesContainedToolbar && (settledBounds.x !== requestedBounds.x || settledBounds.y !== requestedBounds.y)) {
    storeToolbarPositionFromExtendedWindow()
  }

  try {
    await setExtendedToolbarConcealed(false, token)
  } catch (error) {
    // Never leave the application apparently unopened because an ACK was lost.
    rawLog('Pointer toolbar reveal acknowledgement failed:', error)
    extendedToolbarWindow.webContents.send('set_toolbar_concealed', false)
    extendedToolbarWindow.setIgnoreMouseEvents(false)
    reapplyContainedToolbarInputShape()
  }

  hideWindow(mainWindow)

  drawingMode = false
  updateContextMenu()

  releaseFocusBack()
}

function hideApp() {
  rawLog('Hiding app...')

  flushExtendedToolbarPosition()
  resetScreenOnHide()

  hideWindow(mainWindow)
  hideWindow(extendedToolbarWindow)

  drawingMode = false
  updateContextMenu()

  releaseFocusBack()
}

function resetScreenOnHide() {
  if (store.get('clear_drawings_on_hide')) {
    sendResetScreen();
  }
}

const DISPLAY_CHANGE_STARTUP_GRACE_MS = 3000

function handleDisplayChange() {
  // Native Wayland fires several display-added/display-metrics-changed
  // events in a row while the compositor and client settle on scale/geometry
  // right after the first window is created (fractional scaling
  // negotiation) — this is spurious startup churn, not a real monitor
  // change, but was hiding the app every time right after it appeared.
  // Ignore display-change events for a short grace period after launch;
  // genuine hot-plug changes from the user happen well after that.
  if (appReadyAt && Date.now() - appReadyAt < DISPLAY_CHANGE_STARTUP_GRACE_MS) {
    return
  }

  store.delete('active_monitor_id')
  hideApp()
}

function updateExternalToolbarVisibility() {
  if (drawingMode) return;

  if (store.get('disable_toolbar_in_pointer_mode')) {
    hideWindow(extendedToolbarWindow)
    return
  }

  if (store.get('show_tool_bar')) {
    showExtendedToolbarWindow()
  } else {
    hideWindow(extendedToolbarWindow)
  }
}

function toggleToolbar() {
  withThrottle(() => {
    rawLog('Toggling toolbar...')

    store.set('show_tool_bar', !store.get('show_tool_bar'));
    mainWindow.webContents.send('toggle_toolbar') // Roundtrip request ...
  });
}

function toggleWhiteboard() {
  withThrottle(() => {
    rawLog('Toggling whiteboard...')

    store.set('show_whiteboard', !store.get('show_whiteboard'));
    mainWindow.webContents.send('toggle_whiteboard') // Roundtrip request ...
  });
}

function resetApp() {
  withThrottle(() => {
    rawLog('Resetting app to original settings...')

    unRegisterGlobalShortcuts()

    const preservedUserId = store.get('user_id')

    store.clear()

    if (preservedUserId) {
      store.set('user_id', preservedUserId)
    }

    registerGlobalShortcuts()

    if (safeIsOpenAtLogin()) {
      safeSetLoginItemSettings({ openAtLogin: false });
    }

    tray.setImage(getTrayIconPath())

    enablePointerMode()

    mainWindow.reload()

    if (settingsWindow) {
      settingsWindow.reload()
    }
  })
}

function resetScreen() {
  withThrottle(sendResetScreen);
}

function sendResetScreen() {
  rawLog('Resetting screen...')

  mainWindow.webContents.send('reset_screen');
}

function quitApp() {
  withThrottle(() => {
    rawLog('Quitting app...')

    flushExtendedToolbarPosition({ force: true })
    app.quit();
  });
}

function screenshotTimecode4(date) {
  let value = date.getHours() * 3600 +
              date.getMinutes() * 60 +
              date.getSeconds(); // 0..86399

  let code = '';
  for (let i = 0; i < 4; i++) {
    code = String.fromCharCode(97 + (value % 26)) + code;
    value = Math.floor(value / 26);
  }

  return code;
}

function screenshotFilename(withUniqSuffix = false) {
  const date = new Date()

  const yyyy = date.getFullYear();
  const mm = (date.getMonth() + 1).toString().padStart(2, '0');
  const dd = (date.getDate()).toString().padStart(2, '0');

  const code = screenshotTimecode4(date);
  const suffix = withUniqSuffix ? `-${Date.now()}` : '';

  return `DRWPN-${yyyy}${mm}${dd}-${code}${suffix}.png`;
}

async function makeScreenshot() {
  if (!drawingMode) {
    await runToolbarTransition(enableDrawMode)
  }

  try {
    rawLog('Exporting as PNG...')

    if (isMac) {
      const status = systemPreferences.getMediaAccessStatus('screen');
      if (status !== 'granted') {
        // NOTE: Adds an app to Screen & System Audio Recording list
        try {
          await desktopCapturer.getSources({
            types: ['screen'],
            thumbnailSize: { width: 1, height: 1 },
          });
        } catch (_) {}

        throw new Error('Screen Recording permission is not granted.');
      }
    }

    const activeMonitor = getLockedMonitor() || getActiveMonitor() || getUnderCursorMonitor()

    const thumbnailSize = {
      width: Math.round(activeMonitor.size.width * (activeMonitor.scaleFactor || 1)),
      height: Math.round(activeMonitor.size.height * (activeMonitor.scaleFactor || 1)),
    };

    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize,
    });

    if (sources.length === 0) {
      throw new Error('No screen sources available for capture.')
    }

    const source =
      sources.find(s => String(s.display_id ?? s.displayId ?? '') === String(activeMonitor.id)) ||
      sources.find(source => {
        const { width, height } = source.thumbnail.getSize()
        return width === thumbnailSize.width && height === thumbnailSize.height
      }) ||
      sources[0];

    const image = source.thumbnail;

    if (!image || image.isEmpty()) {
      throw new Error('Could not capture the screen.')
    }

    const screenshotsDirectory = path.join(app.getPath('pictures'), 'Screenshots');
    await fs.promises.mkdir(screenshotsDirectory, { recursive: true });

    let savePath = path.join(screenshotsDirectory, screenshotFilename());
    if (fs.existsSync(savePath)) {
      savePath = path.join(screenshotsDirectory, screenshotFilename(true));
    }

    await fs.promises.writeFile(savePath, image.toPNG());

    sendNotification({
      title: `Click to open ${isMac ? 'in Finder' : 'folder'}`,
      body: savePath,
      button_label: 'Open',
      button_action: 'open_screenshot',
      button_data: savePath,
    });
  } catch (error) {
    sendNotification({
      title: 'Image export failed',
      body: error.message,
      button_label: isMac ? 'Settings' : null,
      button_action: isMac ? 'open_security_preferences' : null,
      button_data: null,
    });
  }
}

function sendNotification(data) {
  mainWindow.webContents.send('show_notification', data);
}

function hideWindow(targetWindow) {
  targetWindow.setOpacity(0)
  try {
    targetWindow.hide()
  } finally {
    targetWindow.setOpacity(1)
  }
}

function showWindow(targetWindow, { inactive = false, beforeReveal = null } = {}) {
  targetWindow.setOpacity(0)

  try {
    if (inactive) {
      targetWindow.showInactive()
    } else {
      targetWindow.show()
    }
    targetWindow.moveTop()
    beforeReveal?.()
  } finally {
    targetWindow.setOpacity(1)
  }
}

async function setExtendedToolbarConcealed(concealed, token) {
  await waitForExtendedToolbarWindowLoad()

  if (concealed) {
    if (containedToolbarInputShapeSettleTimeout) {
      clearTimeout(containedToolbarInputShapeSettleTimeout)
      containedToolbarInputShapeSettleTimeout = null
    }

    extendedToolbarWindow.setIgnoreMouseEvents(true)
  }

  const acknowledged = waitForTransitionSignal(
    extendedToolbarConcealedWaiters,
    token,
    concealed ? 'Pointer toolbar concealment' : 'Pointer toolbar reveal',
  )

  extendedToolbarWindow.webContents.send('set_toolbar_concealed', concealed, token)
  await acknowledged

  if (!concealed) {
    extendedToolbarWindow.setIgnoreMouseEvents(false)
    reapplyContainedToolbarInputShape()
  }
}

function releaseFocusBack() {
  if (!isMac) return;

  if (settingsWindow) {
    settingsWindow.focus()
    return
  }

  if (aboutWindow) {
    aboutWindow.focus()
    return
  }

  app.hide()
}

function clampContainedToolbarPosition(position, windowBounds) {
  const maxShapeX = Math.max(0, windowBounds.width - EXTENDED_TOOLBAR_WINDOW_WIDTH)
  const maxShapeY = Math.max(0, windowBounds.height - EXTENDED_TOOLBAR_WINDOW_HEIGHT)
  const shapeX = Math.max(0, Math.min(
    Math.round(position.x - EXTENDED_TOOLBAR_WINDOW_MARGIN),
    maxShapeX,
  ))
  const shapeY = Math.max(0, Math.min(
    Math.round(position.y - EXTENDED_TOOLBAR_WINDOW_MARGIN),
    maxShapeY,
  ))

  return {
    x: shapeX + EXTENDED_TOOLBAR_WINDOW_MARGIN,
    y: shapeY + EXTENDED_TOOLBAR_WINDOW_MARGIN,
    shapeX,
    shapeY,
  }
}

function setContainedToolbarInputRegion(position) {
  if (!isX11 || !extendedToolbarWindow || extendedToolbarWindow.isDestroyed()) return;

  lastContainedToolbarPosition = position
  writeContainedToolbarInputShape(position)
}

function getExtendedToolbarNativeWindowId() {
  const handle = extendedToolbarWindow.getNativeWindowHandle()

  if (handle.length >= 8) {
    return Number(handle.readBigUInt64LE(0))
  }

  return handle.readUInt32LE(0)
}

function getContainedToolbarInputShapeHelperPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'drawpen-x11-input-shape')
  }

  return path.join(process.cwd(), 'assets/build/drawpen-x11-input-shape')
}

function ensureContainedToolbarInputShapeHelper() {
  if (!isX11 || containedToolbarInputShapeHelper) return containedToolbarInputShapeHelper;
  if (!extendedToolbarWindow || extendedToolbarWindow.isDestroyed()) return null;

  const windowId = getExtendedToolbarNativeWindowId()
  const helperPath = getContainedToolbarInputShapeHelperPath()

  try {
    const helper = spawn(helperPath, [`0x${windowId.toString(16)}`], {
      stdio: ['pipe', 'ignore', 'pipe'],
    })
    containedToolbarInputShapeHelper = helper

    helper.stderr.on('data', data => rawLog('X11 input shape helper:', data.toString().trim()))
    helper.on('error', error => {
      rawLog('X11 input shape helper failed:', error)
      if (containedToolbarInputShapeHelper === helper) {
        containedToolbarInputShapeHelper = null
      }
      extendedToolbarWindow?.setIgnoreMouseEvents(true)
    })
    helper.on('exit', (code, signal) => {
      rawLog(`X11 input shape helper exited: code=${code}, signal=${signal}`)
      if (containedToolbarInputShapeHelper === helper) {
        containedToolbarInputShapeHelper = null

        if (!isQuitting && extendedToolbarWindow && !extendedToolbarWindow.isDestroyed()) {
          extendedToolbarWindow.setIgnoreMouseEvents(true)
        }
      }
    })

    return helper
  } catch (error) {
    rawLog('Unable to start X11 input shape helper:', error)
    extendedToolbarWindow.setIgnoreMouseEvents(true)
    return null
  }
}

function writeContainedToolbarInputShape(position) {
  const helper = ensureContainedToolbarInputShapeHelper()
  if (!helper?.stdin?.writable) return;

  helper.stdin.write(
    `${position.shapeX} ${position.shapeY} ${EXTENDED_TOOLBAR_WINDOW_WIDTH} ${EXTENDED_TOOLBAR_WINDOW_HEIGHT}\n`,
  )
}

function reapplyContainedToolbarInputShape() {
  if (!isX11 || !lastContainedToolbarPosition) return;

  writeContainedToolbarInputShape(lastContainedToolbarPosition)

  if (containedToolbarInputShapeSettleTimeout) {
    clearTimeout(containedToolbarInputShapeSettleTimeout)
  }

  // Chromium applies setIgnoreMouseEvents(false) to X11 asynchronously and
  // briefly restores the full input region. Reassert our latest shape after
  // that operation has settled so transparent pixels never capture clicks.
  containedToolbarInputShapeSettleTimeout = setTimeout(() => {
    containedToolbarInputShapeSettleTimeout = null

    if (lastContainedToolbarPosition) {
      writeContainedToolbarInputShape(lastContainedToolbarPosition)
    }
  }, 50)
}

function stopContainedToolbarInputShapeHelper() {
  if (containedToolbarInputShapeSettleTimeout) {
    clearTimeout(containedToolbarInputShapeSettleTimeout)
    containedToolbarInputShapeSettleTimeout = null
  }

  const helper = containedToolbarInputShapeHelper
  containedToolbarInputShapeHelper = null
  lastContainedToolbarPosition = null

  if (!helper) return;
  helper.stdin?.end()
  helper.kill()
}

function configureContainedToolbar(display, windowBounds = extendedToolbarWindow.getContentBounds()) {
  if (!usesContainedToolbar || !extendedToolbarWindow || extendedToolbarWindow.isDestroyed()) return null;

  const requestedScreenX = display.workArea.x + store.get('tool_bar_x')
  const requestedScreenY = display.workArea.y + store.get('tool_bar_y')
  const position = clampContainedToolbarPosition({
    x: requestedScreenX - windowBounds.x,
    y: requestedScreenY - windowBounds.y,
  }, windowBounds)

  setContainedToolbarInputRegion(position)

  if (extendedToolbarWindowLoaded && !extendedToolbarWindow.webContents.isLoading()) {
    extendedToolbarWindow.webContents.send('configure_contained_toolbar', {
      enabled: true,
      x: position.x,
      y: position.y,
    })
  }

  return position
}

function applyContainedToolbarPosition(requestedPosition, { storePosition = false } = {}) {
  if (!usesContainedToolbar || !extendedToolbarWindow || extendedToolbarWindow.isDestroyed()) return;

  const windowBounds = extendedToolbarWindow.getContentBounds()
  const position = clampContainedToolbarPosition(requestedPosition, windowBounds)
  setContainedToolbarInputRegion(position)

  if (position.x !== requestedPosition.x || position.y !== requestedPosition.y) {
    extendedToolbarWindow.webContents.send('configure_contained_toolbar', {
      enabled: true,
      x: position.x,
      y: position.y,
    })
  }

  if (!storePosition) return;

  const currentDisplay = getLockedMonitor() || screen.getDisplayMatching(windowBounds)
  if (!currentDisplay) return;

  const toolBarX = windowBounds.x + position.x - currentDisplay.workArea.x
  const toolBarY = windowBounds.y + position.y - currentDisplay.workArea.y

  rawLog(`Update contained toolbar: display: ${currentDisplay.id}, toolBarX: ${toolBarX}, toolBarY: ${toolBarY}`)

  store.set({
    tool_bar_x: toolBarX,
    tool_bar_y: toolBarY,
  })

  if (!isQuitting) {
    updateMainWindowPosition(currentDisplay)
  }
}

function storeToolbarPositionFromExtendedWindow() {
  if (!extendedToolbarWindow || extendedToolbarWindow.isDestroyed()) return;
  // This reads the window's native position via getBounds(), which only
  // reflects reality when the OS actually lets a client move a window and
  // honestly reports back where it ended up — true for macOS/Windows (and
  // previously assumed for "not X11" generally), but not for native Wayland,
  // which keeps reporting {x:0, y:0} regardless of where the compositor
  // actually placed it. The contained-toolbar path (all of Linux now) never
  // moves this window at all, so it doesn't need this function.
  if (usesContainedToolbar) return;

  const toolbarBounds = extendedToolbarWindow.getBounds()
  const currentDisplay = getLockedMonitor() || screen.getDisplayMatching(toolbarBounds)
  if (!currentDisplay) return;

  const { x: displayX, y: displayY } = currentDisplay.workArea
  const { x: extToolBarX, y: extToolBarY } = toolbarBounds

  const toolBarX = extToolBarX - displayX + EXTENDED_TOOLBAR_WINDOW_MARGIN
  const toolBarY = extToolBarY - displayY + EXTENDED_TOOLBAR_WINDOW_MARGIN

  const storedToolBarX = store.get('tool_bar_x')
  const storedToolBarY = store.get('tool_bar_y')

  if (Math.abs(toolBarX - storedToolBarX) <= 1 && Math.abs(toolBarY - storedToolBarY) <= 1) {
    return
  }

  rawLog(`Update Toolbar: display: ${currentDisplay.id}, toolBarX: ${toolBarX}, toolBarY: ${toolBarY}`)

  store.set({
    tool_bar_x: toolBarX,
    tool_bar_y: toolBarY,
  });

  if (!isQuitting) {
    updateMainWindowPosition(currentDisplay)
  }
}

function scheduleStoreToolbarPositionFromExtendedWindow() {
  if (extendedToolbarPositionStoreTimeout) {
    clearTimeout(extendedToolbarPositionStoreTimeout)
  }

  extendedToolbarPositionStoreTimeout = setTimeout(() => {
    extendedToolbarPositionStoreTimeout = null
    storeToolbarPositionFromExtendedWindow()
  }, updateStoreDelay)
}

function flushExtendedToolbarPosition({ force = false } = {}) {
  if (extendedToolbarPositionStoreTimeout) {
    clearTimeout(extendedToolbarPositionStoreTimeout)
    extendedToolbarPositionStoreTimeout = null
  }

  if (!usesContainedToolbar &&
    extendedToolbarWindow &&
    !extendedToolbarWindow.isDestroyed() &&
    (force || extendedToolbarWindow.isVisible())
  ) {
    storeToolbarPositionFromExtendedWindow()
  }
}

function updateMainWindowPosition(display) {
  if (store.get('active_monitor_id') === display.id) {
    updateToolbarPositionInRenderer()
    return
  }

  mainWindow.setBounds(display.workArea)

  if (isDevelopment) {
    mainWindow.setBounds({
      width: 500,
      height: 500
    })
  }

  mainWindowLoaded = false
  mainWindow.reload()

  store.set('active_monitor_id', display.id)
}

// - Cold Start
// - Enable Toolbar from Tray
// - Enable Pointer Mode (Click by Main Button or from Tray)
function showExtendedToolbarWindow() {
  if (store.get('disable_toolbar_in_pointer_mode')) return;
  if (!store.get('show_tool_bar')) return;

  const currentDisplay = getLockedMonitor() || getActiveMonitor() || getUnderCursorMonitor()

  extendedToolbarWindow.webContents.send('set_toolbar_concealed', false)
  showWindow(extendedToolbarWindow, {
    inactive: true,
    beforeReveal: () => updateExtendedToolbarWindowPosition(currentDisplay),
  })
  extendedToolbarWindow.setIgnoreMouseEvents(false)
  reapplyContainedToolbarInputShape()
}

function updateExtendedToolbarWindowPosition(display) {
  if (usesContainedToolbar) {
    const requestedBounds = { ...display.workArea }

    extendedToolbarWindow.setBounds(requestedBounds)
    configureContainedToolbar(display, requestedBounds)

    return requestedBounds
  }

  const { x: displayX, y: displayY } = display.workArea
  const toolBarX = store.get('tool_bar_x')
  const toolBarY = store.get('tool_bar_y')
  const requestedX = displayX + toolBarX - EXTENDED_TOOLBAR_WINDOW_MARGIN
  const requestedY = displayY + toolBarY - EXTENDED_TOOLBAR_WINDOW_MARGIN

  ignoreExtendedToolbarMoveEvents = true

  if (extendedToolbarPositionStoreTimeout) {
    clearTimeout(extendedToolbarPositionStoreTimeout)
    extendedToolbarPositionStoreTimeout = null
  }

  if (extendedToolbarProgrammaticMoveTimeout) {
    clearTimeout(extendedToolbarProgrammaticMoveTimeout)
  }

  extendedToolbarWindow.setBounds({
    x: requestedX,
    y: requestedY,
  })

  extendedToolbarProgrammaticMoveTimeout = setTimeout(() => {
    extendedToolbarProgrammaticMoveTimeout = null
    ignoreExtendedToolbarMoveEvents = false
  }, updateStoreDelay * 4)

  return { x: requestedX, y: requestedY }
}

function waitForExtendedToolbarBoundsToSettle(requestedBounds) {
  return new Promise((resolve) => {
    const startedAt = Date.now()
    let stableChecks = 0
    let previousBounds = null

    const checkBounds = () => {
      const currentBounds = extendedToolbarWindow.getBounds()
      const matchesPrevious = previousBounds &&
        currentBounds.x === previousBounds.x &&
        currentBounds.y === previousBounds.y
      const matchesRequested =
        Math.abs(currentBounds.x - requestedBounds.x) <= 1 &&
        Math.abs(currentBounds.y - requestedBounds.y) <= 1

      stableChecks = matchesPrevious ? stableChecks + 1 : 0
      previousBounds = currentBounds

      if (stableChecks >= 2 && (matchesRequested || usesContainedToolbar)) {
        resolve(currentBounds)
        return
      }

      if (!matchesRequested && !usesContainedToolbar) {
        extendedToolbarWindow.setBounds(requestedBounds)
      }

      if (Date.now() - startedAt >= 500) {
        rawLog('Pointer toolbar bounds settled with compositor adjustment:', {
          requestedBounds,
          currentBounds,
        })
        resolve(currentBounds)
        return
      }

      setTimeout(checkBounds, 16)
    }

    checkBounds()
  })
}

function getLockedMonitor() {
  const drawingMonitorOptions = store.get('drawing_monitor')

  if (drawingMonitorOptions.mode === 'fixed') {
    return screen.getAllDisplays().find(display => String(display.id) === drawingMonitorOptions.display_id)
  }

  return null
}

function getActiveMonitor() {
  const activeMonitorId = store.get('active_monitor_id')

  return screen.getAllDisplays().find(display => display.id === activeMonitorId)
}

function getUnderCursorMonitor() {
  // Electron's getCursorScreenPoint() spins the main process at ~100% CPU
  // forever under native Wayland + Mutter (confirmed via isolated
  // reproduction with Electron 40) instead of failing gracefully — Wayland's
  // security model doesn't allow querying the global cursor position outside
  // a focused surface. It works fine under X11, so only avoid it there.
  if (!isX11) {
    return screen.getPrimaryDisplay()
  }

  return screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
}

function getUnderToolbarMonitor() {
  if (!extendedToolbarWindow.isVisible()) {
    return null
  }

  return screen.getDisplayMatching(extendedToolbarWindow.getBounds())
}

function getAllDisplaysInfo() {
  const allDisplays = screen.getAllDisplays()

  return allDisplays.map(display => {
    const displayName = display.label || `Display ${display.id}`
    const resolution = `${display.size.width}x${display.size.height}`

    return {
      id: String(display.id),
      label: `${displayName} (${resolution})`,
    }
  })
}

function logDisplays() {
  const displays = screen.getAllDisplays()
  const primaryDisplayId = screen.getPrimaryDisplay().id

  rawLog(`Connected displays: ${displays.length}`)

  displays.forEach((display, index) => {
    rawLog(`Display ${index + 1}:`, {
      id: display.id,
      label: display.label,
      primary: display.id === primaryDisplayId,
      internal: display.internal,
      size: display.size,
      bounds: display.bounds,
      workArea: display.workArea,
      scaleFactor: display.scaleFactor,
      rotation: display.rotation,
      displayFrequency: display.displayFrequency,
    })
  })
}

function normalizeAcceleratorForUI(value) {
  if (!value) return value;

  const target = (isMac) ? 'Meta' : 'Control';
  return value.replace('CmdOrCtrl', target);
}

function deNormalizeAcceleratorFromUI(value) {
  if (!value) return value;

  const target = (isMac) ? 'Meta' : 'Control';
  return value.replace(target, 'CmdOrCtrl');
}

function safeRegisterGlobalShortcut(accelerator, callback) {
  if (!accelerator || accelerator === KEY_NULL) {
    return
  }

  try {
    if (globalShortcut.isRegistered(accelerator)) {
      rawLog('Global shortcut already registered:', accelerator);
      return
    }

    const success = globalShortcut.register(accelerator, callback);
    if (!success) {
      rawLog('Failed to register global shortcut:', accelerator);
    }
  } catch (error) {
    rawLog('Error registering global shortcut:', accelerator, error);
  }
}

function setApplicationName() {
  if (isWin) {
    app.setAppUserModelId('com.squirrel.DrawPen.DrawPen');
  }
}

function safeWasOpenedAtLogin() {
  if (isLinux) return false; // Linux не підтримує login items

  try {
    return !!app.getLoginItemSettings().wasOpenedAtLogin;
  } catch (error) {
    return false;
  }
}

function safeIsOpenAtLogin() {
  if (isLinux) return false;

  try {
    return !!app.getLoginItemSettings().openAtLogin
  } catch (error) {
    return false
  }
}

function safeSetLoginItemSettings(settings) {
  if (isLinux) return;

  try {
    app.setLoginItemSettings(settings)
  } catch (error) {}
}

function launchTracker() {
  if (isDevelopment) { return }

  try {
    const key = process.env.PUBLIC_POSTHOG_KEY;

    if (!key || key === 'undefined' || key === '') {
      return;
    }

    const posthog = new PostHog(key, {
      host: 'https://us.i.posthog.com',
      flushAt: 1
    })

    posthog.capture({
      distinctId: store.get('user_id') || 'anonymous',
      event: 'app_launch',
      properties: {
        platform: 'app',

        app_version: app.getVersion(),

        os_platform: os.platform(),
        os_release:  os.release(),
        arch:        os.arch(),

        config: store.store,
      }
    })
  } catch (_) {}
}

function rawLog(message, ...args) {
  if (!isLoggingEnabled) { return }

  console.log(message, ...args);
}

process.on('uncaughtException', (error) => {
  console.log('[DRAWPEN:FATAL] uncaughtException', error)
  app.quit();
})

process.on('unhandledRejection', (reason) => {
  console.log('[DRAWPEN:FATAL] unhandledRejection', reason)
  app.quit();
})
