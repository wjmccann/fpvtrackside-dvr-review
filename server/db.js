const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.pkg ? path.dirname(process.execPath) : __dirname, 'dvr-review.db');
const nativeBinding = process.pkg
  ? path.join(path.dirname(process.execPath), 'better_sqlite3.node')
  : undefined;

const db = new Database(dbPath, nativeBinding ? { nativeBinding } : undefined);

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    pin_hash TEXT NOT NULL,
    role TEXT DEFAULT 'official',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    event_id TEXT,
    race_id TEXT,
    action TEXT NOT NULL,
    detection_id TEXT,
    before_value TEXT,
    after_value TEXT,
    timestamp TEXT NOT NULL,
    rolled_back INTEGER DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_audit_race ON audit_log(race_id);
  CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);
`);

module.exports = db;
