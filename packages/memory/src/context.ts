import type { DbClient } from "@seawatts/db";
import { getLatestPatternSummary } from "@seawatts/db";
import { getTopMemories, extractKeywords } from "./decay";
import type { DecayOptions } from "./decay";
import { searchSimilarMemories, isEmbeddingAvailable } from "./embeddings";
import { analyzePatterns, shouldConsolidate, consolidateMemories } from "./patterns";

export interface ContextOptions {
  /** Current task text for semantic search */
  taskText?: string;
  /** Tags to boost in decay scoring */
  matchTags?: string[];
  /** Current avoidance type for boosting */
  matchAvoidanceType?: string | null;
}

/**
 * Build a comprehensive memory context string for injection into AI prompts.
 * Combines:
 * 1. Session history / pattern analysis
 * 2. Consolidated pattern summaries
 * 3. Top memories by enhanced decay scoring (keyword + tag matching)
 * 4. Semantically similar memories via embeddings (if available)
 */
export async function buildMemoryContext(
  db: DbClient,
  options: ContextOptions = {},
): Promise<string> {
  if (shouldConsolidate(db)) {
    consolidateMemories(db);
  }

  const parts: string[] = [];

  // Section 1: Session history overview
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

  // Section 2: Consolidated patterns
  const patternSummary = getLatestPatternSummary(db);
  if (patternSummary) {
    parts.push("");
    parts.push("--- Consolidated Patterns ---");
    parts.push(patternSummary.summaryText);
  }

  // Section 3: Top memories by enhanced decay scoring
  const decayOptions: DecayOptions = {
    matchTags: options.matchTags,
    matchAvoidanceType: options.matchAvoidanceType,
  };

  if (options.taskText) {
    decayOptions.matchKeywords = extractKeywords(options.taskText);
  }

  const topMemories = getTopMemories(db, 8, decayOptions);
  if (topMemories.length > 0) {
    parts.push("");
    parts.push("--- Recent Memories (by relevance) ---");
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

  // Section 4: Semantically similar memories (if embeddings available and task text provided)
  if (options.taskText && isEmbeddingAvailable()) {
    try {
      const similar = await searchSimilarMemories(db, options.taskText, {
        limit: 5,
        minSimilarity: 0.4,
      });

      // Filter out memories already shown in top memories
      const topIds = new Set(topMemories.map((m) => m.id));
      const uniqueSimilar = similar.filter((s) => !topIds.has(s.memory.id));

      if (uniqueSimilar.length > 0) {
        parts.push("");
        parts.push("--- Semantically Related Memories ---");
        for (const { memory, similarity } of uniqueSimilar) {
          const dateStr = new Date(memory.createdAt).toLocaleDateString();
          const simPct = Math.round(similarity * 100);
          parts.push(`[${simPct}% match, ${dateStr}] ${memory.content}`);
        }
      }
    } catch {
      // Embedding search failed silently -- decay-based results still available
    }
  }

  if (parts.length === 0) {
    return "This is the user's first session. No prior history available.";
  }

  return parts.join("\n");
}
