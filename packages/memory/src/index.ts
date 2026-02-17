// High-level API
export { storeMemory, backfillEmbeddings } from "./store";
export type { StoreMemoryInput } from "./store";

// Context building
export { buildMemoryContext } from "./context";
export type { ContextOptions } from "./context";

// Decay scoring
export {
  calculateDecayScore,
  getTopMemories,
  getMemoriesByType,
  extractKeywords,
  getHalfLifeDays,
} from "./decay";
export type { DecayOptions } from "./decay";

// Embeddings
export {
  generateEmbedding,
  cosineSimilarity,
  searchSimilarMemories,
  isEmbeddingAvailable,
  EMBEDDING_DIMENSIONS,
} from "./embeddings";

// Pattern analysis
export {
  analyzePatterns,
  shouldConsolidate,
  consolidateMemories,
} from "./patterns";
export type { PatternAnalysis } from "./patterns";
