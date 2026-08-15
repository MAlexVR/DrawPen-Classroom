console.log('[DRAWPEN]: Main page preloading...');

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Renderer -> Main
  invokeCloseApp: () => ipcRenderer.invoke('close_app'),
  invokePointerMode: (toolbarScreenPosition) => ipcRenderer.invoke('toggle_draw_or_pointer_window', toolbarScreenPosition),
  invokeOpenSettings: () => ipcRenderer.invoke('open_settings'),
  invokeMakeScreenshot: () => ipcRenderer.invoke('make_screenshot'),
  invokeOpenNotification: (info) => ipcRenderer.invoke('open_notification', info),
  invokeGetSettings: () => ipcRenderer.invoke('get_settings'),
  invokeSetSettings: (settings) => ipcRenderer.invoke('set_settings', settings),
  invokeSetToolbarColor: (colorId, color) => ipcRenderer.invoke('set_toolbar_color', colorId, color),
  invokeSetToolbarPosition: (toolbarScreenPosition) => ipcRenderer.invoke('set_toolbar_position_from_draw_mode', toolbarScreenPosition),
  notifyDrawToolbarGeometryReady: (token, geometry) => ipcRenderer.send('draw_toolbar_geometry_ready', token, geometry),
  notifyDrawToolbarPositionApplied: (token, geometry) => ipcRenderer.send('draw_toolbar_position_applied', token, geometry),

  // Main -> Renderer
  onResetScreen: (callback) => ipcRenderer.on('reset_screen', callback),
  onToggleToolbar: (callback) => ipcRenderer.on('toggle_toolbar', callback),
  onToggleWhiteboard: (callback) => ipcRenderer.on('toggle_whiteboard', callback),
  onRefreshSettings: (callback) => ipcRenderer.on('refresh_settings', callback),
  onPrepareDrawToolbar: (callback) => ipcRenderer.on('prepare_draw_toolbar', callback),
  onApplyDrawToolbarPosition: (callback) => ipcRenderer.on('apply_draw_toolbar_position', callback),
  onUpdateToolbarPosition: (callback) => ipcRenderer.on('update_toolbar_position', callback),
  onShowNotification: (callback) => ipcRenderer.on('show_notification', callback),
});
