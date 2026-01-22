import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  },

  // Database operations
  db: {
    execute: (sql: string, params?: any[]) =>
      ipcRenderer.invoke('db:execute', sql, params),
    get: (sql: string, params?: any[]) =>
      ipcRenderer.invoke('db:get', sql, params),
    all: (sql: string, params?: any[]) =>
      ipcRenderer.invoke('db:all', sql, params),
  },

  // App info
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    getPlatform: () => ipcRenderer.invoke('app:getPlatform'),
  },

  // Event listeners
  on: (channel: string, callback: (...args: any[]) => void) => {
    const allowedChannels = ['sync:status', 'order:update', 'session:update'];
    if (allowedChannels.includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => callback(...args));
    }
  },

  off: (channel: string, callback: (...args: any[]) => void) => {
    ipcRenderer.removeListener(channel, callback);
  },
});

// Type definitions for TypeScript
declare global {
  interface Window {
    electronAPI: {
      window: {
        minimize: () => void;
        maximize: () => void;
        close: () => void;
        isMaximized: () => Promise<boolean>;
      };
      db: {
        execute: (sql: string, params?: any[]) => Promise<{ success: boolean; data?: any; error?: string }>;
        get: (sql: string, params?: any[]) => Promise<{ success: boolean; data?: any; error?: string }>;
        all: (sql: string, params?: any[]) => Promise<{ success: boolean; data?: any[]; error?: string }>;
      };
      app: {
        getVersion: () => Promise<string>;
        getPlatform: () => Promise<string>;
      };
      on: (channel: string, callback: (...args: any[]) => void) => void;
      off: (channel: string, callback: (...args: any[]) => void) => void;
    };
  }
}
