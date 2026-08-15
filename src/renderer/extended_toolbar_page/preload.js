console.log('[DRAWPEN]: Extended toolbar page preloading...');

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Renderer -> Main
  invokeCloseApp: () => ipcRenderer.invoke('close_app'),
  invokeDrawMode: () => ipcRenderer.invoke('toggle_draw_or_pointer_window'),
  notifyToolbarConcealed: (token, concealed) => ipcRenderer.send('extended_toolbar_concealed', token, concealed),
  sendContainedToolbarPosition: (position, finished) => ipcRenderer.send('move_contained_toolbar', position, finished),

  // Main -> Renderer
  onSetConcealed: (callback) => ipcRenderer.on('set_toolbar_concealed', (_event, concealed, token) => callback(concealed, token)),
  onConfigureContainedToolbar: (callback) => ipcRenderer.on('configure_contained_toolbar', (_event, configuration) => callback(configuration)),
});
