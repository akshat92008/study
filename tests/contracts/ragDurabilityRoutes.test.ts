import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function read(file: string): string {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

describe('RAG durable route contracts', () => {
  it('ingests small chat uploads inline while preserving queued fallback', () => {
    const chatRoute = read('app/api/ai/chat/route.ts');
    const uploadsRoute = read('lib/chat/uploads.ts');
    const combined = chatRoute + uploadsRoute;

    expect(combined).toContain('INLINE_INGESTION_MAX_BYTES');
    expect(combined).toContain('shouldIngestInline');
    expect(combined).toContain('await ingestStudyMaterial({');
    expect(combined).toContain("type: 'MATERIAL_UPLOADED'");
    expect(combined).toContain(".from('rag_ingestion_jobs')");
    expect(combined).toContain("onConflict: 'user_id,material_id,idempotency_key'");
    expect(combined).toContain('Source uploaded and indexed. I extracted');
    expect(combined).toContain('Source uploaded and queued for indexing');
  });

  it('ingests small user material reprocess inline with queued fallback', () => {
    const reprocessRoute = read('app/api/materials/[id]/reprocess/route.ts');

    expect(reprocessRoute).toContain('INLINE_REPROCESS_MAX_BYTES');
    expect(reprocessRoute).toContain('ingestStudyMaterial');
    expect(reprocessRoute).toContain(".download(");
    expect(reprocessRoute).toContain("type: 'MATERIAL_INGESTION_REQUESTED'");
    expect(reprocessRoute).toContain(".from('rag_ingestion_jobs')");
    expect(reprocessRoute).toContain('status: 202');
    expect(reprocessRoute).toContain("result.status === 'ready' ? 200 : 202");
  });
});
