import type { DbClient } from "../client";
import type { Memory } from "../schema";
import { getAllMemories, incrementMemoryAccess } from "../queries";

const LAMBDA = 0.05;
const ACCESS_BONUS_PER = 0.1;
const ACCESS_BONUS_CAP = 5;

export function calculateDecayScore(memory: Memory, now: Date = new Date()): number {
  const createdAt = new Date(memory.createdAt);
  const daysSinceCreated = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

  const decayFactor = Math.exp(-LAMBDA * daysSinceCreated);
  const accessBonus = ACCESS_BONUS_PER * Math.min(memory.accessCount ?? 0, ACCESS_BONUS_CAP);

  return (memory.importance ?? 1.0) * decayFactor + accessBonus;
}

export function getTopMemories(db: DbClient, limit = 10): Memory[] {
  const all = getAllMemories(db);
  const now = new Date();

  const scored = all.map((memory) => ({
    memory,
    score: calculateDecayScore(memory, now),
  }));

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, limit);

  for (const { memory } of top) {
    incrementMemoryAccess(db, memory.id);
  }

  return top.map(({ memory }) => memory);
}

export function getMemoriesByType(db: DbClient, type: string, limit = 5): Memory[] {
  const all = getAllMemories(db);
  const now = new Date();

  const filtered = all.filter((m) => m.type === type);
  const scored = filtered.map((memory) => ({
    memory,
    score: calculateDecayScore(memory, now),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(({ memory }) => memory);
}

export function getHalfLifeDays(): number {
  return Math.log(2) / LAMBDA;
}
