import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '..', '..', 'data', 'jobs.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  const dir = path.dirname(DB_PATH);
  fs.mkdirSync(dir, { recursive: true });

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');

  initializeSchema(db);
  return db;
}

function initializeSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      website TEXT,
      description TEXT,
      funding_stage TEXT,
      total_raised TEXT,
      last_funding_date TEXT,
      headcount_min INTEGER,
      headcount_max INTEGER,
      location TEXT,
      investors TEXT DEFAULT '[]',
      founded_year INTEGER,
      logo_url TEXT,
      industry TEXT,
      source TEXT NOT NULL DEFAULT 'unknown',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_name_website
      ON companies(name, website);

    CREATE INDEX IF NOT EXISTS idx_companies_funding_stage
      ON companies(funding_stage);

    CREATE INDEX IF NOT EXISTS idx_companies_location
      ON companies(location);

    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL REFERENCES companies(id),
      title TEXT NOT NULL,
      normalized_title TEXT NOT NULL,
      description TEXT,
      location TEXT,
      remote_type TEXT CHECK(remote_type IN ('remote', 'hybrid', 'onsite')),
      salary_min INTEGER,
      salary_max INTEGER,
      salary_currency TEXT DEFAULT 'USD',
      url TEXT NOT NULL,
      source TEXT NOT NULL,
      source_id TEXT,
      dedup_hash TEXT NOT NULL,
      posted_at TEXT,
      scraped_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
      is_active INTEGER NOT NULL DEFAULT 1,
      merged_from TEXT DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_jobs_company_id ON jobs(company_id);
    CREATE INDEX IF NOT EXISTS idx_jobs_dedup_hash ON jobs(dedup_hash);
    CREATE INDEX IF NOT EXISTS idx_jobs_is_active ON jobs(is_active);
    CREATE INDEX IF NOT EXISTS idx_jobs_posted_at ON jobs(posted_at);
    CREATE INDEX IF NOT EXISTS idx_jobs_source ON jobs(source);
    CREATE INDEX IF NOT EXISTS idx_jobs_remote_type ON jobs(remote_type);
    CREATE INDEX IF NOT EXISTS idx_jobs_location ON jobs(location);

    CREATE TABLE IF NOT EXISTS funding_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL REFERENCES companies(id),
      round_type TEXT NOT NULL,
      amount TEXT,
      date TEXT,
      investors TEXT DEFAULT '[]',
      source_url TEXT,
      scraped_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_funding_company_id ON funding_events(company_id);
    CREATE INDEX IF NOT EXISTS idx_funding_date ON funding_events(date);

    CREATE TABLE IF NOT EXISTS scrape_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('success', 'error', 'partial')),
      jobs_found INTEGER DEFAULT 0,
      jobs_new INTEGER DEFAULT 0,
      jobs_updated INTEGER DEFAULT 0,
      jobs_deactivated INTEGER DEFAULT 0,
      error_message TEXT,
      duration_ms INTEGER DEFAULT 0,
      timestamp TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_scrape_logs_source ON scrape_logs(source);
    CREATE INDEX IF NOT EXISTS idx_scrape_logs_timestamp ON scrape_logs(timestamp);
  `);

  // Create FTS5 virtual table for full-text search
  const ftsExists = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='jobs_fts'"
  ).get();

  if (!ftsExists) {
    db.exec(`
      CREATE VIRTUAL TABLE jobs_fts USING fts5(
        title,
        description,
        company_name,
        location,
        content='',
        contentless_delete=1,
        tokenize='porter unicode61'
      );
    `);
  }
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
