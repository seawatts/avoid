import { eq, desc, sql, count } from "drizzle-orm";
import { createId } from "@seawatts/id";
import type { DbClient } from "./client";
import { sessions, memories, patternSummaries } from "./schema";
import type {
  Session,
  Memory,
  PatternSummary,
  SessionStatus,
  AvoidanceType,
  MemoryType,
  AgenticTurn,
} from "./schema";

// --- Session queries ---

export function createSession(db: DbClient): Session {
  const id = createId();
  const now = new Date().toISOString();

  const rows = db
    .insert(sessions)
    .values({
      id,
      createdAt: now,
      updatedAt: now,
      status: "in_progress",
    })
    .returning()
    .all();

  return rows[0]!;
}

export function getInProgressSession(db: DbClient): Session | undefined {
  const rows = db
    .select()
    .from(sessions)
    .where(eq(sessions.status, "in_progress"))
    .orderBy(desc(sessions.updatedAt))
    .limit(1)
    .all();

  return rows[0];
}

export function getSession(db: DbClient, id: string): Session | undefined {
  const rows = db
    .select()
    .from(sessions)
    .where(eq(sessions.id, id))
    .limit(1)
    .all();

  return rows[0];
}

export function updateSession(
  db: DbClient,
  id: string,
  updates: Partial<{
    status: SessionStatus;
    task: string;
    spousePerspective: string;
    avoidanceType: string;
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
  db.update(sessions)
    .set({ ...updates, updatedAt: now })
    .where(eq(sessions.id, id))
    .run();
}

export function getSessionCount(db: DbClient): number {
  const rows = db.select({ count: count() }).from(sessions).all();
  return rows[0]?.count ?? 0;
}

export function getCompletedSessionCount(db: DbClient): number {
  const rows = db
    .select({ count: count() })
    .from(sessions)
    .where(eq(sessions.status, "completed"))
    .all();
  return rows[0]?.count ?? 0;
}

export function getTimerCompletionRate(db: DbClient): number {
  const total = getCompletedSessionCount(db);
  if (total === 0) return 0;

  const rows = db
    .select({ count: count() })
    .from(sessions)
    .where(eq(sessions.timerCompleted, true))
    .all();

  return (rows[0]?.count ?? 0) / total;
}

export function getAvoidanceTypeStats(db: DbClient): Record<string, number> {
  const rows = db
    .select({
      avoidanceType: sessions.avoidanceType,
      count: count(),
    })
    .from(sessions)
    .where(sql`${sessions.avoidanceType} IS NOT NULL`)
    .groupBy(sessions.avoidanceType)
    .orderBy(desc(count()))
    .all();

  const stats: Record<string, number> = {};
  for (const row of rows) {
    if (row.avoidanceType) {
      stats[row.avoidanceType] = row.count;
    }
  }
  return stats;
}

// --- Memory queries ---

export function createMemory(
  db: DbClient,
  data: {
    sessionId: string | null;
    type: MemoryType;
    content: string;
    avoidanceType: AvoidanceType | null;
    importance: number;
    tags: string[];
    embedding?: Buffer | null;
  },
): Memory {
  const id = createId();
  const now = new Date().toISOString();

  const rows = db
    .insert(memories)
    .values({
      id,
      createdAt: now,
      sessionId: data.sessionId,
      type: data.type,
      content: data.content,
      avoidanceType: data.avoidanceType,
      importance: data.importance,
      tags: data.tags,
      embedding: data.embedding ?? null,
    })
    .returning()
    .all();

  return rows[0]!;
}

export function updateMemoryEmbedding(db: DbClient, id: string, embedding: Buffer): void {
  db.update(memories)
    .set({ embedding })
    .where(eq(memories.id, id))
    .run();
}

export function getMemoriesWithEmbeddings(db: DbClient): Memory[] {
  return db
    .select()
    .from(memories)
    .where(sql`${memories.embedding} IS NOT NULL`)
    .orderBy(desc(memories.createdAt))
    .all();
}

export function getAllMemories(db: DbClient): Memory[] {
  return db
    .select()
    .from(memories)
    .orderBy(desc(memories.createdAt))
    .all();
}

export function incrementMemoryAccess(db: DbClient, id: string): void {
  const now = new Date().toISOString();
  db.update(memories)
    .set({
      accessCount: sql`${memories.accessCount} + 1`,
      lastAccessedAt: now,
    })
    .where(eq(memories.id, id))
    .run();
}

export function reduceMemoryImportance(db: DbClient, id: string, factor: number): void {
  db.update(memories)
    .set({
      importance: sql`${memories.importance} * ${factor}`,
    })
    .where(eq(memories.id, id))
    .run();
}

// --- Pattern summary queries ---

export function createPatternSummary(
  db: DbClient,
  summaryText: string,
  data: Record<string, unknown>,
): PatternSummary {
  const id = createId();
  const now = new Date().toISOString();

  const rows = db
    .insert(patternSummaries)
    .values({ id, createdAt: now, summaryText, data })
    .returning()
    .all();

  return rows[0]!;
}

export function getLatestPatternSummary(db: DbClient): PatternSummary | undefined {
  const rows = db
    .select()
    .from(patternSummaries)
    .orderBy(desc(patternSummaries.createdAt))
    .limit(1)
    .all();

  return rows[0];
}
