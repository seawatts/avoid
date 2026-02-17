import { Database } from "bun:sqlite";
import { nanoid } from "nanoid";
import type {
  Session,
  SessionStatus,
  AvoidanceType,
  MemoryType,
  Memory,
  PatternSummary,
  AgenticTurn,
} from "../types";
import { homedir } from "node:os";
import { mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const AVOID_DIR = join(homedir(), ".avoid");
const DB_PATH = join(AVOID_DIR, "avoid.db");

let _db: Database | null = null;

export function getStore(): Database {
  if (_db) return _db;

  if (!existsSync(AVOID_DIR)) {
    mkdirSync(AVOID_DIR, { recursive: true });
  }

  _db = new Database(DB_PATH);
  _db.exec("PRAGMA journal_mode = WAL");
  _db.exec("PRAGMA foreign_keys = ON");
  runMigrations(_db);
  return _db;
}

function runMigrations(db: Database): void {
  db.exec(`
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
      tags TEXT DEFAULT '[]'
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
  `);
}

// --- Session CRUD ---

export function createSession(db: Database): Session {
  const id = nanoid();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO sessions (id, created_at, updated_at, status)
    VALUES (?, ?, ?, 'in_progress')
  `).run(id, now, now);

  return {
    id,
    createdAt: now,
    updatedAt: now,
    status: "in_progress",
    task: null,
    spousePerspective: null,
    avoidanceType: null,
    explanation: null,
    tenMinuteVersion: null,
    twoMinuteVersion: null,
    uglyFirstDraft: null,
    timerStarted: false,
    timerCompleted: false,
    agenticLog: [],
  };
}

export function getInProgressSession(db: Database): Session | null {
  const row = db
    .prepare("SELECT * FROM sessions WHERE status = 'in_progress' ORDER BY updated_at DESC LIMIT 1")
    .get() as Record<string, unknown> | null;

  if (!row) return null;
  return rowToSession(row);
}

export function getSession(db: Database, id: string): Session | null {
  const row = db
    .prepare("SELECT * FROM sessions WHERE id = ?")
    .get(id) as Record<string, unknown> | null;

  if (!row) return null;
  return rowToSession(row);
}

export function updateSession(
  db: Database,
  id: string,
  updates: Partial<{
    status: SessionStatus;
    task: string;
    spousePerspective: string;
    avoidanceType: AvoidanceType;
    explanation: string;
    tenMinuteVersion: string;
    twoMinuteVersion: string;
    uglyFirstDraft: string;
    timerStarted: boolean;
    timerCompleted: boolean;
    agenticLog: AgenticTurn[];
  }>,
): void {
  const now = new Date().toISOString();
  const sets: string[] = ["updated_at = ?"];
  const values: unknown[] = [now];

  if (updates.status !== undefined) {
    sets.push("status = ?");
    values.push(updates.status);
  }
  if (updates.task !== undefined) {
    sets.push("task = ?");
    values.push(updates.task);
  }
  if (updates.spousePerspective !== undefined) {
    sets.push("spouse_perspective = ?");
    values.push(updates.spousePerspective);
  }
  if (updates.avoidanceType !== undefined) {
    sets.push("avoidance_type = ?");
    values.push(updates.avoidanceType);
  }
  if (updates.explanation !== undefined) {
    sets.push("explanation = ?");
    values.push(updates.explanation);
  }
  if (updates.tenMinuteVersion !== undefined) {
    sets.push("ten_minute_version = ?");
    values.push(updates.tenMinuteVersion);
  }
  if (updates.twoMinuteVersion !== undefined) {
    sets.push("two_minute_version = ?");
    values.push(updates.twoMinuteVersion);
  }
  if (updates.uglyFirstDraft !== undefined) {
    sets.push("ugly_first_draft = ?");
    values.push(updates.uglyFirstDraft);
  }
  if (updates.timerStarted !== undefined) {
    sets.push("timer_started = ?");
    values.push(updates.timerStarted ? 1 : 0);
  }
  if (updates.timerCompleted !== undefined) {
    sets.push("timer_completed = ?");
    values.push(updates.timerCompleted ? 1 : 0);
  }
  if (updates.agenticLog !== undefined) {
    sets.push("agentic_log = ?");
    values.push(JSON.stringify(updates.agenticLog));
  }

  values.push(id);
  db.prepare(`UPDATE sessions SET ${sets.join(", ")} WHERE id = ?`).run(...values);
}

export function getSessionCount(db: Database): number {
  const row = db.prepare("SELECT COUNT(*) as count FROM sessions").get() as { count: number };
  return row.count;
}

export function getCompletedSessionCount(db: Database): number {
  const row = db
    .prepare("SELECT COUNT(*) as count FROM sessions WHERE status = 'completed'")
    .get() as { count: number };
  return row.count;
}

export function getTimerCompletionRate(db: Database): number {
  const total = db
    .prepare("SELECT COUNT(*) as count FROM sessions WHERE status = 'completed'")
    .get() as { count: number };
  const withTimer = db
    .prepare("SELECT COUNT(*) as count FROM sessions WHERE timer_completed = 1")
    .get() as { count: number };

  if (total.count === 0) return 0;
  return withTimer.count / total.count;
}

// --- Memory CRUD ---

export function createMemory(
  db: Database,
  data: {
    sessionId: string | null;
    type: MemoryType;
    content: string;
    avoidanceType: AvoidanceType | null;
    importance: number;
    tags: string[];
  },
): Memory {
  const id = nanoid();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO memories (id, created_at, session_id, type, content, avoidance_type, importance, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, now, data.sessionId, data.type, data.content, data.avoidanceType, data.importance, JSON.stringify(data.tags));

  return {
    id,
    createdAt: now,
    sessionId: data.sessionId,
    type: data.type,
    content: data.content,
    avoidanceType: data.avoidanceType,
    importance: data.importance,
    accessCount: 0,
    lastAccessedAt: null,
    tags: data.tags,
  };
}

export function getAllMemories(db: Database): Memory[] {
  const rows = db
    .prepare("SELECT * FROM memories ORDER BY created_at DESC")
    .all() as Record<string, unknown>[];
  return rows.map(rowToMemory);
}

export function incrementMemoryAccess(db: Database, id: string): void {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE memories SET access_count = access_count + 1, last_accessed_at = ? WHERE id = ?
  `).run(now, id);
}

export function reduceMemoryImportance(db: Database, id: string, factor: number): void {
  db.prepare("UPDATE memories SET importance = importance * ? WHERE id = ?").run(factor, id);
}

// --- Pattern Summaries ---

export function createPatternSummary(
  db: Database,
  summaryText: string,
  data: Record<string, unknown>,
): PatternSummary {
  const id = nanoid();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO pattern_summaries (id, created_at, summary_text, data)
    VALUES (?, ?, ?, ?)
  `).run(id, now, summaryText, JSON.stringify(data));

  return { id, createdAt: now, summaryText, data };
}

export function getLatestPatternSummary(db: Database): PatternSummary | null {
  const row = db
    .prepare("SELECT * FROM pattern_summaries ORDER BY created_at DESC LIMIT 1")
    .get() as Record<string, unknown> | null;

  if (!row) return null;
  return {
    id: row.id as string,
    createdAt: row.created_at as string,
    summaryText: row.summary_text as string,
    data: JSON.parse((row.data as string) || "{}"),
  };
}

// --- Avoidance type stats ---

export function getAvoidanceTypeStats(db: Database): Record<string, number> {
  const rows = db
    .prepare(`
      SELECT avoidance_type, COUNT(*) as count
      FROM sessions
      WHERE avoidance_type IS NOT NULL
      GROUP BY avoidance_type
      ORDER BY count DESC
    `)
    .all() as { avoidance_type: string; count: number }[];

  const stats: Record<string, number> = {};
  for (const row of rows) {
    stats[row.avoidance_type] = row.count;
  }
  return stats;
}

// --- Row converters ---

function rowToSession(row: Record<string, unknown>): Session {
  let agenticLog: AgenticTurn[] = [];
  try {
    agenticLog = JSON.parse((row.agentic_log as string) || "[]");
  } catch {
    agenticLog = [];
  }

  return {
    id: row.id as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    status: row.status as SessionStatus,
    task: (row.task as string) || null,
    spousePerspective: (row.spouse_perspective as string) || null,
    avoidanceType: (row.avoidance_type as AvoidanceType) || null,
    explanation: (row.explanation as string) || null,
    tenMinuteVersion: (row.ten_minute_version as string) || null,
    twoMinuteVersion: (row.two_minute_version as string) || null,
    uglyFirstDraft: (row.ugly_first_draft as string) || null,
    timerStarted: Boolean(row.timer_started),
    timerCompleted: Boolean(row.timer_completed),
    agenticLog,
  };
}

function rowToMemory(row: Record<string, unknown>): Memory {
  let tags: string[] = [];
  try {
    tags = JSON.parse((row.tags as string) || "[]");
  } catch {
    tags = [];
  }

  return {
    id: row.id as string,
    createdAt: row.created_at as string,
    sessionId: (row.session_id as string) || null,
    type: row.type as MemoryType,
    content: row.content as string,
    avoidanceType: (row.avoidance_type as AvoidanceType) || null,
    importance: row.importance as number,
    accessCount: row.access_count as number,
    lastAccessedAt: (row.last_accessed_at as string) || null,
    tags,
  };
}
