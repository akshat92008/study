import { describe, expect, it, vi, afterEach } from 'vitest';
import { getRagConfig, RAG_DEFAULTS } from '@/lib/rag/config';

describe('RAG Limits', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses tight beta safe defaults when env is missing', () => {
    vi.stubEnv('RAG_MAX_FILE_MB', '');
    vi.stubEnv('RAG_MAX_FILES_PER_USER', '');
    vi.stubEnv('RAG_MAX_DAILY_UPLOADS', '');
    vi.stubEnv('RAG_MAX_CHUNKS_PER_FILE', '');
    vi.stubEnv('RAG_CHUNK_SIZE_CHARS', '');
    vi.stubEnv('RAG_TOP_K', '');
    vi.stubEnv('RAG_MAX_CONTEXT_CHARS', '');
    const config = getRagConfig();
    expect(config.maxFileBytes).toBe(3 * 1024 * 1024);
    expect(config.maxFilesPerUser).toBe(5);
    expect(config.maxDailyUploads).toBe(1);
    expect(config.maxChunksPerFile).toBe(40);
    expect(config.chunkSizeChars).toBe(2500);
    expect(config.topK).toBe(4);
    expect(config.maxContextChars).toBe(6000);
  });

  it('allows env overrides for future scaling', () => {
    vi.stubEnv('RAG_MAX_FILE_MB', '15');
    vi.stubEnv('RAG_MAX_DAILY_UPLOADS', '10');
    vi.stubEnv('RAG_TOP_K', '6');
    
    const config = getRagConfig();
    expect(config.maxFileBytes).toBe(15 * 1024 * 1024);
    expect(config.maxDailyUploads).toBe(10);
    expect(config.topK).toBe(6);
  });

  it('enforces hard limit on topK', () => {
    vi.stubEnv('RAG_TOP_K', '100');
    const config = getRagConfig();
    expect(config.topK).toBe(8); // hardMaxTopK
  });
});
