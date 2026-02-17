import type { DbClient, AvoidanceType, MemoryType, Memory } from "@seawatts/db";
import { createMemory, updateMemoryEmbedding } from "@seawatts/db";
import { generateEmbedding, isEmbeddingAvailable } from "./embeddings";
import { extractKeywords } from "./decay";

export interface StoreMemoryInput {
  sessionId: string | null;
  type: MemoryType;
  content: string;
  avoidanceType: AvoidanceType | null;
  importance?: number;
  tags?: string[];
}

/**
 * Store a new memory with automatic embedding generation.
 * - Extracts keywords from content and merges them into tags
 * - Generates an OpenAI embedding for semantic search (if API key available)
 * - Falls back gracefully to tag-only storage if embeddings fail
 */
export async function storeMemory(
  db: DbClient,
  input: StoreMemoryInput,
): Promise<Memory> {
  const { sessionId, type, content, avoidanceType, importance = 1.0, tags = [] } = input;

  // Auto-extract keywords and merge with provided tags
  const keywords = extractKeywords(content);
  const allTags = [...new Set([...tags, ...keywords.slice(0, 10)])];

  // Generate embedding if available
  let embedding: Buffer | null = null;
  if (isEmbeddingAvailable()) {
    try {
      embedding = await generateEmbedding(content);
    } catch {
      // Embedding generation failed -- store without embedding
    }
  }

  const memory = createMemory(db, {
    sessionId,
    type,
    content,
    avoidanceType,
    importance,
    tags: allTags,
    embedding,
  });

  return memory;
}

/**
 * Backfill embeddings for memories that don't have them yet.
 * Useful for upgrading existing databases.
 */
export async function backfillEmbeddings(
  db: DbClient,
  options: { batchSize?: number } = {},
): Promise<number> {
  if (!isEmbeddingAvailable()) return 0;

  const { batchSize = 50 } = options;
  const { getAllMemories } = await import("@seawatts/db");
  const allMemories = getAllMemories(db);

  const withoutEmbeddings = allMemories.filter((m) => !m.embedding);
  const batch = withoutEmbeddings.slice(0, batchSize);

  let count = 0;
  for (const memory of batch) {
    try {
      const emb = await generateEmbedding(memory.content);
      updateMemoryEmbedding(db, memory.id, emb);
      count++;
    } catch {
      // Skip individual failures
    }
  }

  return count;
}
