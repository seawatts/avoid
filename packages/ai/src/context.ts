import type { DbClient } from "@seawatts/db";
import { getTopMemories, analyzePatterns, shouldConsolidate, consolidateMemories } from "@seawatts/db/memory";
import { getLatestPatternSummary } from "@seawatts/db/queries";

export function buildMemoryContext(db: DbClient): string {
  if (shouldConsolidate(db)) {
    consolidateMemories(db);
  }

  const parts: string[] = [];

  const patterns = analyzePatterns(db);
  if (patterns.totalSessions > 0) {
    parts.push("--- User History ---");
    parts.push(
      `Sessions: ${patterns.totalSessions} total, ${patterns.completedSessions} completed.`,
    );

    if (patterns.timerCompletionRate > 0) {
      parts.push(
        `Timer completion rate: ${Math.round(patterns.timerCompletionRate * 100)}%.`,
      );
    }

    if (patterns.mostCommonType) {
      parts.push(
        `Most common avoidance pattern: ${patterns.mostCommonType} (${patterns.typePercentages[patterns.mostCommonType] ?? 0}%).`,
      );
    }

    const typeEntries = Object.entries(patterns.typePercentages);
    if (typeEntries.length > 1) {
      const breakdown = typeEntries.map(([type, pct]) => `${type}: ${pct}%`).join(", ");
      parts.push(`Full breakdown: ${breakdown}.`);
    }
  }

  const patternSummary = getLatestPatternSummary(db);
  if (patternSummary) {
    parts.push("");
    parts.push("--- Consolidated Patterns ---");
    parts.push(patternSummary.summaryText);
  }

  const topMemories = getTopMemories(db, 10);
  if (topMemories.length > 0) {
    parts.push("");
    parts.push("--- Recent Memories ---");
    for (const memory of topMemories) {
      const dateStr = new Date(memory.createdAt).toLocaleDateString();
      const prefix =
        memory.type === "observation"
          ? "Obs"
          : memory.type === "insight"
            ? "Insight"
            : memory.type === "pattern"
              ? "Pattern"
              : "Summary";
      parts.push(`[${prefix} ${dateStr}] ${memory.content}`);
    }
  }

  if (parts.length === 0) {
    return "This is the user's first session. No prior history available.";
  }

  return parts.join("\n");
}
