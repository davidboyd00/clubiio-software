"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  // Window controls
  window: {
    minimize: () => electron.ipcRenderer.send("window:minimize"),
    maximize: () => electron.ipcRenderer.send("window:maximize"),
    close: () => electron.ipcRenderer.send("window:close"),
    isMaximized: () => electron.ipcRenderer.invoke("window:isMaximized")
  },
  // Database operations
  db: {
    execute: (sql, params) => electron.ipcRenderer.invoke("db:execute", sql, params),
    get: (sql, params) => electron.ipcRenderer.invoke("db:get", sql, params),
    all: (sql, params) => electron.ipcRenderer.invoke("db:all", sql, params)
  },
  // App info
  app: {
    getVersion: () => electron.ipcRenderer.invoke("app:getVersion"),
    getPlatform: () => electron.ipcRenderer.invoke("app:getPlatform")
  },
  // Event listeners
  on: (channel, callback) => {
    const allowedChannels = ["sync:status", "order:update", "session:update"];
    if (allowedChannels.includes(channel)) {
      electron.ipcRenderer.on(channel, (_event, ...args) => callback(...args));
    }
  },
  off: (channel, callback) => {
    electron.ipcRenderer.removeListener(channel, callback);
  }
});
