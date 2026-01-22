"use strict";
const electron = require("electron");
const path = require("path");
const Database = require("better-sqlite3");
const fs = require("fs");
let db = null;
function initDatabase() {
  return new Promise((resolve, reject) => {
    try {
      const userDataPath = electron.app.getPath("userData");
      const dbPath = path.join(userDataPath, "clubio.db");
      console.log("Database path:", dbPath);
      const dbDir = path.dirname(dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }
      db = new Database(dbPath);
      db.pragma("journal_mode = WAL");
      createTables();
      console.log("Database initialized successfully");
      resolve();
    } catch (error) {
      console.error("Failed to initialize database:", error);
      reject(error);
    }
  });
}
function createTables() {
  if (!db) return;
  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      synced INTEGER DEFAULT 0
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS cached_products (
      id TEXT PRIMARY KEY,
      category_id TEXT,
      name TEXT NOT NULL,
      short_name TEXT,
      price REAL NOT NULL,
      is_alcoholic INTEGER DEFAULT 0,
      barcode TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS cached_categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT,
      icon TEXT,
      sort_order INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS local_orders (
      id TEXT PRIMARY KEY,
      cash_session_id TEXT,
      order_number INTEGER,
      status TEXT DEFAULT 'PENDING',
      subtotal REAL,
      discount REAL DEFAULT 0,
      total REAL,
      items TEXT,
      payments TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      synced INTEGER DEFAULT 0
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS session_info (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      user_id TEXT,
      tenant_id TEXT,
      venue_id TEXT,
      cash_session_id TEXT,
      cash_register_id TEXT,
      access_token TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log("Database tables created");
}
function getDatabase() {
  return db;
}
let mainWindow = null;
const isDev = process.env.NODE_ENV === "development" || !electron.app.isPackaged;
function createWindow() {
  const { width, height } = electron.screen.getPrimaryDisplay().workAreaSize;
  mainWindow = new electron.BrowserWindow({
    width: Math.min(1400, width),
    height: Math.min(900, height),
    minWidth: 1024,
    minHeight: 768,
    frame: false,
    // Frameless window for modern look
    titleBarStyle: "hidden",
    trafficLightPosition: { x: -100, y: -100 },
    // Hide macOS traffic lights
    backgroundColor: "#0f172a",
    // Slate-900
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
      // Required for better-sqlite3
    },
    show: false
    // Don't show until ready
  });
  mainWindow.once("ready-to-show", () => {
    mainWindow == null ? void 0 : mainWindow.show();
    if (isDev) {
      mainWindow == null ? void 0 : mainWindow.webContents.openDevTools();
    }
  });
  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
electron.app.whenReady().then(async () => {
  try {
    await initDatabase();
  } catch (error) {
    console.warn("SQLite initialization skipped (will use online mode only):", error);
  }
  createWindow();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
electron.ipcMain.on("window:minimize", () => {
  mainWindow == null ? void 0 : mainWindow.minimize();
});
electron.ipcMain.on("window:maximize", () => {
  if (mainWindow == null ? void 0 : mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow == null ? void 0 : mainWindow.maximize();
  }
});
electron.ipcMain.on("window:close", () => {
  mainWindow == null ? void 0 : mainWindow.close();
});
electron.ipcMain.handle("window:isMaximized", () => {
  return (mainWindow == null ? void 0 : mainWindow.isMaximized()) ?? false;
});
electron.ipcMain.handle("db:execute", async (_event, sql, params = []) => {
  try {
    const db2 = getDatabase();
    if (!db2) return { success: false, error: "Database not available" };
    const stmt = db2.prepare(sql);
    if (sql.trim().toUpperCase().startsWith("SELECT")) {
      return { success: true, data: stmt.all(...params) };
    } else {
      const result = stmt.run(...params);
      return { success: true, data: result };
    }
  } catch (error) {
    console.error("Database error:", error);
    return { success: false, error: String(error) };
  }
});
electron.ipcMain.handle("db:get", async (_event, sql, params = []) => {
  try {
    const db2 = getDatabase();
    if (!db2) return { success: false, error: "Database not available" };
    const stmt = db2.prepare(sql);
    return { success: true, data: stmt.get(...params) };
  } catch (error) {
    console.error("Database error:", error);
    return { success: false, error: String(error) };
  }
});
electron.ipcMain.handle("db:all", async (_event, sql, params = []) => {
  try {
    const db2 = getDatabase();
    if (!db2) return { success: false, error: "Database not available" };
    const stmt = db2.prepare(sql);
    return { success: true, data: stmt.all(...params) };
  } catch (error) {
    console.error("Database error:", error);
    return { success: false, error: String(error) };
  }
});
electron.ipcMain.handle("app:getVersion", () => {
  return electron.app.getVersion();
});
electron.ipcMain.handle("app:getPlatform", () => {
  return process.platform;
});
