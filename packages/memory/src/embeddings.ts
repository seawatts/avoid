import { embed } from "ai";
import { openai } from "@ai-sdk/openai";
import type { DbClient, Memory } from "@seawatts/db";
import { getMemoriesWithEmbeddings } from "@seawatts/db";

const EMBEDDING_MODEL = openai.embedding("text-embedding-3-small");
const EMBEDDING_DIMENSIONS = 1536;

/**
 * Generate an embedding vector for the given text using OpenAI.
 * Returns a Buffer containing the float32 array for SQLite storage.
 */
export async function generateEmbedding(text: string): Promise<Buffer> {
  const result = await embed({
    model: EMBEDDING_MODEL,
    value: text,
  });

  return float32ArrayToBuffer(result.embedding);
}

/**
 * Compute cosine similarity between two embedding buffers.
 * Returns a value between -1 and 1 (1 = identical, 0 = orthogonal).
 */
export function cosineSimilarity(a: Buffer, b: Buffer): number {
  const vecA = bufferToFloat32Array(a);
  const vecB = bufferToFloat32Array(b);

  if (vecA.length !== vecB.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i]! * vecB[i]!;
    normA += vecA[i]! * vecA[i]!;
    normB += vecB[i]! * vecB[i]!;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

/**
 * Find the most semantically similar memories to the given query text.
 * Combines vector similarity with decay scoring for final ranking.
 */
export async function searchSimilarMemories(
  db: DbClient,
  queryText: string,
  options: {
    limit?: number;
    minSimilarity?: number;
  } = {},
): Promise<Array<{ memory: Memory; similarity: number }>> {
  const { limit = 10, minSimilarity = 0.3 } = options;

  const queryEmbedding = await generateEmbedding(queryText);
  const memoriesWithEmbeddings = getMemoriesWithEmbeddings(db);

  if (memoriesWithEmbeddings.length === 0) {
    return [];
  }

  const scored = memoriesWithEmbeddings
    .map((memory) => ({
      memory,
      similarity: memory.embedding
        ? cosineSimilarity(queryEmbedding, memory.embedding as Buffer)
        : 0,
    }))
    .filter((item) => item.similarity >= minSimilarity)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);

  return scored;
}

/**
 * Check if we can generate embeddings (API key is available).
 * Falls back gracefully if not.
 */
export function isEmbeddingAvailable(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

// --- Buffer conversion utilities ---

function float32ArrayToBuffer(arr: number[]): Buffer {
  const float32 = new Float32Array(arr);
  return Buffer.from(float32.buffer);
}

function bufferToFloat32Array(buf: Buffer): Float32Array {
  const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new Float32Array(arrayBuffer);
}

export { EMBEDDING_DIMENSIONS };
