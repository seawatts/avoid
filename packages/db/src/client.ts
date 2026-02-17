import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { homedir } from "node:os";
import { mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import * as schema from "./schema";

const AVOID_DIR = join(homedir(), ".avoid");
const DB_PATH = join(AVOID_DIR, "avoid.db");

let _sqlite: Database | null = null;
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (_db) return _db;

  if (!existsSync(AVOID_DIR)) {
    mkdirSync(AVOID_DIR, { recursive: true });
  }

  _sqlite = new Database(DB_PATH);
  _sqlite.exec("PRAGMA journal_mode = WAL");
  _sqlite.exec("PRAGMA foreign_keys = ON");

  runMigrations(_sqlite);

  _db = drizzle(_sqlite, { schema });
  return _db;
}

export type DbClient = ReturnType<typeof getDb>;

function runMigrations(sqlite: Database): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'in_progress',
      task TEXT,
      spouse_perspective TEXT,
      avoidance_type TEXT,
      explanation TEXT,
      ten_minute_version TEXT,
      two_minute_version TEXT,
      ugly_first_draft TEXT,
      timer_started INTEGER DEFAULT 0,
      timer_completed INTEGER DEFAULT 0,
      agentic_log TEXT DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      session_id TEXT REFERENCES sessions(id),
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      avoidance_type TEXT,
      importance REAL DEFAULT 1.0,
      access_count INTEGER DEFAULT 0,
      last_accessed_at TEXT,
      tags TEXT DEFAULT '[]',
      embedding BLOB
    );

    CREATE TABLE IF NOT EXISTS pattern_summaries (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      summary_text TEXT NOT NULL,
      data TEXT NOT NULL DEFAULT '{}'
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
    CREATE INDEX IF NOT EXISTS idx_memories_session ON memories(session_id);
    CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type);
    CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(created_at);
    CREATE INDEX IF NOT EXISTS idx_memories_avoidance ON memories(avoidance_type);
  `);

  // Migration: add embedding column if missing (for existing databases)
  try {
    sqlite.exec("ALTER TABLE memories ADD COLUMN embedding BLOB");
  } catch {
    // Column already exists
  }
}
