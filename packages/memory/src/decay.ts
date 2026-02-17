import type { DbClient, Memory } from "@seawatts/db";
import { getAllMemories, incrementMemoryAccess } from "@seawatts/db";

// --- Decay parameters ---
const LAMBDA = 0.05;
const ACCESS_BONUS_PER = 0.1;
const ACCESS_BONUS_CAP = 5;
const TAG_MATCH_BONUS = 0.15;
const KEYWORD_MATCH_BONUS = 0.1;
const TYPE_MATCH_BONUS = 0.2;
const MAX_TAG_BONUS = 0.6;
const MAX_KEYWORD_BONUS = 0.5;

export interface DecayOptions {
  /** Tags to boost matching memories */
  matchTags?: string[];
  /** Keywords to boost matching memories (matched against content) */
  matchKeywords?: string[];
  /** Avoidance type to boost matching memories */
  matchAvoidanceType?: string | null;
}

/**
 * Calculate the decay score for a memory.
 * Base score = importance * e^(-lambda * days) + access_bonus
 * Enhanced with tag matching, keyword matching, and avoidance type matching.
 */
export function calculateDecayScore(
  memory: Memory,
  now: Date = new Date(),
  options: DecayOptions = {},
): number {
  const createdAt = new Date(memory.createdAt);
  const daysSinceCreated = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

  // Base exponential decay
  const decayFactor = Math.exp(-LAMBDA * daysSinceCreated);

  // Access recency bonus (capped)
  const accessBonus = ACCESS_BONUS_PER * Math.min(memory.accessCount ?? 0, ACCESS_BONUS_CAP);

  // Tag matching bonus
  let tagBonus = 0;
  if (options.matchTags && options.matchTags.length > 0) {
    const memoryTags = (memory.tags ?? []) as string[];
    const matchCount = options.matchTags.filter((tag) =>
      memoryTags.some((mt) => mt.toLowerCase() === tag.toLowerCase()),
    ).length;
    tagBonus = Math.min(matchCount * TAG_MATCH_BONUS, MAX_TAG_BONUS);
  }

  // Keyword matching bonus (substring match in content)
  let keywordBonus = 0;
  if (options.matchKeywords && options.matchKeywords.length > 0) {
    const contentLower = memory.content.toLowerCase();
    const matchCount = options.matchKeywords.filter((kw) =>
      contentLower.includes(kw.toLowerCase()),
    ).length;
    keywordBonus = Math.min(matchCount * KEYWORD_MATCH_BONUS, MAX_KEYWORD_BONUS);
  }

  // Avoidance type match bonus
  let typeBonus = 0;
  if (
    options.matchAvoidanceType &&
    memory.avoidanceType &&
    memory.avoidanceType.toLowerCase() === options.matchAvoidanceType.toLowerCase()
  ) {
    typeBonus = TYPE_MATCH_BONUS;
  }

  return (memory.importance ?? 1.0) * decayFactor + accessBonus + tagBonus + keywordBonus + typeBonus;
}

/**
 * Get the top memories ranked by enhanced decay score.
 * Increments access count on retrieved memories.
 */
export function getTopMemories(
  db: DbClient,
  limit = 10,
  options: DecayOptions = {},
): Memory[] {
  const all = getAllMemories(db);
  const now = new Date();

  const scored = all.map((memory) => ({
    memory,
    score: calculateDecayScore(memory, now, options),
  }));

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, limit);

  for (const { memory } of top) {
    incrementMemoryAccess(db, memory.id);
  }

  return top.map(({ memory }) => memory);
}

/**
 * Get top memories filtered by type, ranked by decay score.
 */
export function getMemoriesByType(
  db: DbClient,
  type: string,
  limit = 5,
  options: DecayOptions = {},
): Memory[] {
  const all = getAllMemories(db);
  const now = new Date();

  const filtered = all.filter((m) => m.type === type);
  const scored = filtered.map((memory) => ({
    memory,
    score: calculateDecayScore(memory, now, options),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(({ memory }) => memory);
}

/**
 * Extract keywords from text for matching purposes.
 * Filters out common stop words, returns unique lowercase tokens.
 */
export function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "can", "shall", "to", "of", "in", "for",
    "on", "with", "at", "by", "from", "as", "into", "through", "during",
    "before", "after", "and", "but", "or", "nor", "not", "so", "yet",
    "both", "either", "neither", "each", "every", "all", "any", "few",
    "more", "most", "other", "some", "such", "no", "only", "own", "same",
    "than", "too", "very", "just", "about", "above", "below", "between",
    "i", "me", "my", "we", "our", "you", "your", "he", "him", "his",
    "she", "her", "it", "its", "they", "them", "their", "this", "that",
    "these", "those", "what", "which", "who", "whom", "when", "where",
    "why", "how", "if", "then", "because", "while", "although", "though",
  ]);

  const tokens = text.toLowerCase().split(/\W+/).filter(Boolean);
  const unique = [...new Set(tokens)].filter(
    (t) => t.length > 2 && !stopWords.has(t),
  );

  return unique;
}

export function getHalfLifeDays(): number {
  return Math.log(2) / LAMBDA;
}
