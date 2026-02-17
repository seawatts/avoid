import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    status: text("status", { enum: ["in_progress", "completed", "abandoned"] })
      .notNull()
      .default("in_progress"),
    task: text("task"),
    spousePerspective: text("spouse_perspective"),
    avoidanceType: text("avoidance_type"),
    explanation: text("explanation"),
    tenMinuteVersion: text("ten_minute_version"),
    twoMinuteVersion: text("two_minute_version"),
    uglyFirstDraft: text("ugly_first_draft"),
    timerStarted: integer("timer_started", { mode: "boolean" }).default(false),
    timerCompleted: integer("timer_completed", { mode: "boolean" }).default(false),
    agenticLog: text("agentic_log", { mode: "json" }).$type<AgenticTurn[]>().default([]),
  },
  (table) => [
    index("idx_sessions_status").on(table.status),
  ],
);

export const memories = sqliteTable(
  "memories",
  {
    id: text("id").primaryKey(),
    createdAt: text("created_at").notNull(),
    sessionId: text("session_id").references(() => sessions.id),
    type: text("type", { enum: ["observation", "pattern", "insight", "summary"] }).notNull(),
    content: text("content").notNull(),
    avoidanceType: text("avoidance_type"),
    importance: real("importance").default(1.0),
    accessCount: integer("access_count").default(0),
    lastAccessedAt: text("last_accessed_at"),
    tags: text("tags", { mode: "json" }).$type<string[]>().default([]),
  },
  (table) => [
    index("idx_memories_session").on(table.sessionId),
    index("idx_memories_type").on(table.type),
    index("idx_memories_created").on(table.createdAt),
  ],
);

export const patternSummaries = sqliteTable("pattern_summaries", {
  id: text("id").primaryKey(),
  createdAt: text("created_at").notNull(),
  summaryText: text("summary_text").notNull(),
  data: text("data", { mode: "json" }).$type<Record<string, unknown>>().default({}),
});

// Types inferred from schema
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Memory = typeof memories.$inferSelect;
export type NewMemory = typeof memories.$inferInsert;
export type PatternSummary = typeof patternSummaries.$inferSelect;

export type SessionStatus = "in_progress" | "completed" | "abandoned";

export type AvoidanceType =
  | "Ambiguity"
  | "Fear"
  | "Perfectionism"
  | "Boredom"
  | "Energy mismatch"
  | "Social discomfort";

export type MemoryType = "observation" | "pattern" | "insight" | "summary";

export interface AgenticTurn {
  role: "ai" | "user";
  action?: string;
  message: string;
  timestamp: string;
}
