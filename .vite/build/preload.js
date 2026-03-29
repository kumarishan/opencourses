"use strict";
const electron = require("electron");
const electronAPI = {
  invoke: (channel, ...args) => {
    return electron.ipcRenderer.invoke(channel, ...args);
  },
  on: (channel, listener) => {
    electron.ipcRenderer.on(channel, listener);
    return () => electron.ipcRenderer.removeListener(channel, listener);
  },
  off: (channel, listener) => {
    electron.ipcRenderer.removeListener(channel, listener);
  }
};
electron.contextBridge.exposeInMainWorld("electron", electronAPI);
//# sourceMappingURL=preload.js.map
