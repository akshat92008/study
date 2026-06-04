import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function read(file: string): string {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

describe('RAG durable route contracts', () => {
  it('keeps normal chat material upload off inline ingestion', () => {
    const chatRoute = read('app/api/ai/chat/route.ts');
    const uploadsRoute = read('lib/chat/uploads.ts');
    const combined = chatRoute + uploadsRoute;

    expect(combined).not.toContain('ingestStudyMaterial');
    expect(combined).toContain("type: 'MATERIAL_UPLOADED'");
    expect(combined).toContain(".from('rag_ingestion_jobs')");
    expect(combined).toContain("onConflict: 'user_id,material_id,idempotency_key'");
    expect(combined).toContain('Source uploaded and queued for indexing');
  });

  it('queues user material reprocess instead of downloading and ingesting inline', () => {
    const reprocessRoute = read('app/api/materials/[id]/reprocess/route.ts');

    expect(reprocessRoute).not.toContain('ingestStudyMaterial');
    expect(reprocessRoute).not.toContain(".download(");
    expect(reprocessRoute).toContain("type: 'MATERIAL_INGESTION_REQUESTED'");
    expect(reprocessRoute).toContain(".from('rag_ingestion_jobs')");
    expect(reprocessRoute).toContain('status: 202');
  });
});
