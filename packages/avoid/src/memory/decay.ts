import type { Database } from "bun:sqlite";
import type { Memory } from "../types";
import { getAllMemories, incrementMemoryAccess } from "./store";

const LAMBDA = 0.05;
const ACCESS_BONUS_PER = 0.1;
const ACCESS_BONUS_CAP = 5;

export function calculateDecayScore(memory: Memory, now: Date = new Date()): number {
  const createdAt = new Date(memory.createdAt);
  const daysSinceCreated = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

  const decayFactor = Math.exp(-LAMBDA * daysSinceCreated);
  const accessBonus = ACCESS_BONUS_PER * Math.min(memory.accessCount, ACCESS_BONUS_CAP);

  return memory.importance * decayFactor + accessBonus;
}

export function getTopMemories(db: Database, limit: number = 10): Memory[] {
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

export function getMemoriesByType(
  db: Database,
  type: string,
  limit: number = 5,
): Memory[] {
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
