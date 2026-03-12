const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('clippy', {
  getHistory: () => ipcRenderer.invoke('get-history'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  getTrackingState: () => ipcRenderer.invoke('get-tracking-state'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  copyItem: (item) => ipcRenderer.invoke('copy-item', item),
  copyItemPlain: (item) => ipcRenderer.invoke('copy-item-plain', item),
  deleteItem: (id) => ipcRenderer.invoke('delete-item', id),
  pinItem: (id) => ipcRenderer.invoke('pin-item', id),
  setItemTags: (id, tags) => ipcRenderer.invoke('set-item-tags', id, tags),
  toggleSnippet: (id) => ipcRenderer.invoke('toggle-snippet', id),
  toggleTracking: () => ipcRenderer.invoke('toggle-tracking'),
  clearHistory: () => ipcRenderer.invoke('clear-history'),
  openSettings: () => ipcRenderer.invoke('open-settings'),
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  searchHistory: (query) => ipcRenderer.invoke('search-history', query),
  onHistoryUpdated: (callback) => {
    ipcRenderer.on('history-updated', (_, data) => callback(data));
  },
  onTrackingUpdated: (callback) => {
    ipcRenderer.on('tracking-updated', (_, data) => callback(data));
  }
});
