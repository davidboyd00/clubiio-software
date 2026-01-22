import { app, BrowserWindow, ipcMain, screen } from 'electron';
import path from 'path';
import { initDatabase, getDatabase } from './database';

let mainWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: Math.min(1400, width),
    height: Math.min(900, height),
    minWidth: 1024,
    minHeight: 768,
    frame: false, // Frameless window for modern look
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: -100, y: -100 }, // Hide macOS traffic lights
    backgroundColor: '#0f172a', // Slate-900
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // Required for better-sqlite3
    },
    show: false, // Don't show until ready
  });

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    if (isDev) {
      mainWindow?.webContents.openDevTools();
    }
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Initialize app
app.whenReady().then(async () => {
  // Initialize SQLite database (optional - may fail in dev mode)
  try {
    await initDatabase();
  } catch (error) {
    console.warn('SQLite initialization skipped (will use online mode only):', error);
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ============================================
// IPC Handlers - Window Controls
// ============================================

ipcMain.on('window:minimize', () => {
  mainWindow?.minimize();
});

ipcMain.on('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

ipcMain.on('window:close', () => {
  mainWindow?.close();
});

ipcMain.handle('window:isMaximized', () => {
  return mainWindow?.isMaximized() ?? false;
});

// ============================================
// IPC Handlers - Database Operations
// ============================================

ipcMain.handle('db:execute', async (_event, sql: string, params: any[] = []) => {
  try {
    const db = getDatabase();
    if (!db) return { success: false, error: 'Database not available' };
    const stmt = db.prepare(sql);

    if (sql.trim().toUpperCase().startsWith('SELECT')) {
      return { success: true, data: stmt.all(...params) };
    } else {
      const result = stmt.run(...params);
      return { success: true, data: result };
    }
  } catch (error) {
    console.error('Database error:', error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('db:get', async (_event, sql: string, params: any[] = []) => {
  try {
    const db = getDatabase();
    if (!db) return { success: false, error: 'Database not available' };
    const stmt = db.prepare(sql);
    return { success: true, data: stmt.get(...params) };
  } catch (error) {
    console.error('Database error:', error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('db:all', async (_event, sql: string, params: any[] = []) => {
  try {
    const db = getDatabase();
    if (!db) return { success: false, error: 'Database not available' };
    const stmt = db.prepare(sql);
    return { success: true, data: stmt.all(...params) };
  } catch (error) {
    console.error('Database error:', error);
    return { success: false, error: String(error) };
  }
});

// ============================================
// IPC Handlers - App Info
// ============================================

ipcMain.handle('app:getVersion', () => {
  return app.getVersion();
});

ipcMain.handle('app:getPlatform', () => {
  return process.platform;
});
