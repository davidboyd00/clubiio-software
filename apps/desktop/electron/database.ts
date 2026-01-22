import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';

let db: Database.Database | null = null;

export function initDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      // Create data directory if it doesn't exist
      const userDataPath = app.getPath('userData');
      const dbPath = path.join(userDataPath, 'clubio.db');

      console.log('Database path:', dbPath);

      // Ensure directory exists
      const dbDir = path.dirname(dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      // Initialize database
      db = new Database(dbPath);
      db.pragma('journal_mode = WAL');

      // Create tables for offline mode
      createTables();

      console.log('Database initialized successfully');
      resolve();
    } catch (error) {
      console.error('Failed to initialize database:', error);
      reject(error);
    }
  });
}

function createTables() {
  if (!db) return;

  // Offline sync queue
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

  // Cached products for offline mode
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

  // Cached categories
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

  // Local orders (for offline mode)
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

  // App settings
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  // Session info
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

  console.log('Database tables created');
}

export function getDatabase(): Database.Database | null {
  return db;
}

export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}
