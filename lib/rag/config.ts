export const RAG_DEFAULTS = {
  maxFileMb: 10,
  maxFilesPerUser: 20,
  maxDailyUploads: 3,
  maxChunksPerFile: 160,
  chunkSizeChars: 3200,
  chunkOverlapChars: 450,
  topK: 5,
  hardMaxTopK: 8,
  maxContextChars: 10000,
  minSimilarity: 0.68,
};

function numberFromEnv(key: string, fallback: number, min = 0): number {
  const value = Number(process.env[key]);
  return Number.isFinite(value) && value >= min ? value : fallback;
}

export function getRagConfig() {
  const topK = numberFromEnv('RAG_TOP_K', RAG_DEFAULTS.topK, 1);
  return {
    maxFileBytes: numberFromEnv('RAG_MAX_FILE_MB', RAG_DEFAULTS.maxFileMb, 1) * 1024 * 1024,
    maxFilesPerUser: numberFromEnv('RAG_MAX_FILES_PER_USER', RAG_DEFAULTS.maxFilesPerUser, 1),
    maxDailyUploads: numberFromEnv('RAG_MAX_DAILY_UPLOADS', RAG_DEFAULTS.maxDailyUploads, 1),
    maxChunksPerFile: numberFromEnv('RAG_MAX_CHUNKS_PER_FILE', RAG_DEFAULTS.maxChunksPerFile, 1),
    chunkSizeChars: numberFromEnv('RAG_CHUNK_SIZE_CHARS', RAG_DEFAULTS.chunkSizeChars, 500),
    chunkOverlapChars: numberFromEnv('RAG_CHUNK_OVERLAP_CHARS', RAG_DEFAULTS.chunkOverlapChars, 0),
    topK: Math.min(topK, RAG_DEFAULTS.hardMaxTopK),
    hardMaxTopK: RAG_DEFAULTS.hardMaxTopK,
    maxContextChars: numberFromEnv('RAG_MAX_CONTEXT_CHARS', RAG_DEFAULTS.maxContextChars, 1000),
    minSimilarity: numberFromEnv('RAG_MIN_SIMILARITY', RAG_DEFAULTS.minSimilarity, 0),
    enableOcr: process.env.RAG_ENABLE_OCR === 'true',
    requireCitations: process.env.RAG_REQUIRE_CITATIONS !== 'false',
  };
}

export const SUPPORTED_MATERIAL_MIME_TYPES = new Set([
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/x-markdown',
  'application/markdown',
]);
