import type { DbClient, AvoidanceType } from "@seawatts/db";
import {
  getAvoidanceTypeStats,
  getSessionCount,
  getCompletedSessionCount,
  getTimerCompletionRate,
  getAllMemories,
  createPatternSummary,
  reduceMemoryImportance,
} from "@seawatts/db";

export interface PatternAnalysis {
  totalSessions: number;
  completedSessions: number;
  timerCompletionRate: number;
  mostCommonType: AvoidanceType | null;
  typeDistribution: Record<string, number>;
  typePercentages: Record<string, number>;
}

export function analyzePatterns(db: DbClient): PatternAnalysis {
  const totalSessions = getSessionCount(db);
  const completedSessions = getCompletedSessionCount(db);
  const timerCompletionRate = getTimerCompletionRate(db);
  const typeDistribution = getAvoidanceTypeStats(db);

  let mostCommonType: AvoidanceType | null = null;
  let maxCount = 0;
  for (const [type, typeCount] of Object.entries(typeDistribution)) {
    if (typeCount > maxCount) {
      maxCount = typeCount;
      mostCommonType = type as AvoidanceType;
    }
  }

  const typePercentages: Record<string, number> = {};
  const totalTyped = Object.values(typeDistribution).reduce((a, b) => a + b, 0);
  if (totalTyped > 0) {
    for (const [type, typeCount] of Object.entries(typeDistribution)) {
      typePercentages[type] = Math.round((typeCount / totalTyped) * 100);
    }
  }

  return {
    totalSessions,
    completedSessions,
    timerCompletionRate,
    mostCommonType,
    typeDistribution,
    typePercentages,
  };
}

export function shouldConsolidate(db: DbClient): boolean {
  const sessionCount = getSessionCount(db);
  return sessionCount > 0 && sessionCount % 10 === 0;
}

export function consolidateMemories(db: DbClient): void {
  const patterns = analyzePatterns(db);
  const allMemories = getAllMemories(db);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const oldMemories = allMemories.filter(
    (m) => new Date(m.createdAt) < thirtyDaysAgo && m.type !== "summary",
  );

  if (oldMemories.length === 0) return;

  const summaryParts: string[] = [];

  if (patterns.mostCommonType) {
    summaryParts.push(
      `Most common avoidance type: ${patterns.mostCommonType} (${patterns.typePercentages[patterns.mostCommonType] ?? 0}% of sessions).`,
    );
  }

  summaryParts.push(
    `${patterns.totalSessions} total sessions, ${patterns.completedSessions} completed.`,
  );

  if (patterns.timerCompletionRate > 0) {
    summaryParts.push(
      `Timer completion rate: ${Math.round(patterns.timerCompletionRate * 100)}%.`,
    );
  }

  const typeEntries = Object.entries(patterns.typePercentages);
  if (typeEntries.length > 1) {
    const breakdown = typeEntries.map(([type, pct]) => `${type}: ${pct}%`).join(", ");
    summaryParts.push(`Type breakdown: ${breakdown}.`);
  }

  const observationContents = oldMemories
    .filter((m) => m.type === "observation")
    .slice(0, 5)
    .map((m) => m.content);

  if (observationContents.length > 0) {
    summaryParts.push(`Key past observations: ${observationContents.join("; ")}`);
  }

  createPatternSummary(db, summaryParts.join(" "), {
    totalSessions: patterns.totalSessions,
    typeDistribution: patterns.typeDistribution,
    timerCompletionRate: patterns.timerCompletionRate,
    consolidatedMemoryCount: oldMemories.length,
  });

  for (const memory of oldMemories) {
    reduceMemoryImportance(db, memory.id, 0.3);
  }
}
