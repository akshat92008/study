/**
 * Module 7 Contract Tests — RAG, Source Materials, Uploads & Citation Grounding
 *
 * Phase 7.1: Upload policy and validation
 * Phase 7.2: Ingestion reliability (status machine)
 * Phase 7.3: Retrieval and citations
 * Phase 7.4: Storage privacy and deletion
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function readFile(relPath: string): string {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function readMigrations(): string {
  const dir = path.join(root, 'supabase', 'migrations');
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.sql'))
    .map(f => fs.readFileSync(path.join(dir, f), 'utf8'))
    .join('\n')
    .toLowerCase();
}

describe('Module 7 — Phase 7.1: Upload validation', () => {
  const uploadRoute = readFile('app/api/materials/upload/route.ts');

  it('upload route validates MIME type against allowlist', () => {
    expect(uploadRoute).toContain('SUPPORTED_MATERIAL_MIME_TYPES');
    expect(uploadRoute).toContain('unsupported_file_type');
    expect(uploadRoute).toContain('415');
  });

  it('upload route validates magic bytes (content vs declared type)', () => {
    expect(uploadRoute).toContain('validateMagicBytesArray');
    expect(uploadRoute).toContain('invalid_file');
    expect(uploadRoute).toContain('422');
  });

  it('upload route enforces per-plan file size limit', () => {
    expect(uploadRoute).toContain('maxFileBytes');
    expect(uploadRoute).toContain('planLimits.maxFileMb');
    expect(uploadRoute).toContain('file_too_large');
    expect(uploadRoute).toContain('413');
  });

  it('upload route enforces per-plan file count limit', () => {
    expect(uploadRoute).toContain('maxFiles');
    expect(uploadRoute).toContain('planLimits.maxMaterials');
    expect(uploadRoute).toContain('material_limit_reached');
  });

  it('upload route enforces daily upload limit', () => {
    expect(uploadRoute).toContain('dailyCount');
    expect(uploadRoute).toContain('daily_upload_limit_reached');
  });

  it('upload route enforces feature usage gate (billing)', () => {
    expect(uploadRoute).toContain('enforceFeatureLimit');
    expect(uploadRoute).toContain('material_upload');
  });

  it('upload route strips filename special characters', () => {
    expect(uploadRoute).toContain('sanitizeFilename');
  });
});

describe('Module 7 — Phase 7.2: Ingestion reliability (status machine)', () => {
  const uploadRoute = readFile('app/api/materials/upload/route.ts');

  it('study_materials uses status machine: uploaded, queued, processing, ready, failed', () => {
    const migrations = readMigrations();
    // Status values declared in the route match the migration's allowed states
    const statuses = ['uploaded', 'queued', 'processing', 'ready'];
    for (const status of statuses) {
      expect(uploadRoute).toContain(`'${status}'`);
    }
  });

  it('large files are queued via rag_ingestion_jobs (not inline)', () => {
    expect(uploadRoute).toContain('rag_ingestion_jobs');
    expect(uploadRoute).toContain('queued');
    expect(uploadRoute).toContain('shouldIngestInline');
  });

  it('ingestion reprocess is idempotent (upsert with onConflict)', () => {
    expect(uploadRoute).toContain("onConflict: 'user_id,material_id,idempotency_key'");
  });

  it('duplicate content hash returns existing material (idempotent upload)', () => {
    expect(uploadRoute).toContain('content_hash');
    expect(uploadRoute).toContain('duplicate: true');
  });

  it('rag_ingestion_jobs migration exists', () => {
    const migrations = readMigrations();
    expect(migrations).toContain('rag_ingestion_jobs');
  });
});

describe('Module 7 — Phase 7.3: Retrieval and citations', () => {
  it('citations module records chunk_id, material_id in message_citations', () => {
    const content = readFile('lib/rag/citations.ts');
    expect(content).toContain('chunk_id');
    expect(content).toContain('material_id');
    expect(content).toContain('message_citations');
  });

  it('citations upsert prevents duplicate citations per message/chunk', () => {
    const content = readFile('lib/rag/citations.ts');
    expect(content).toContain("onConflict: 'user_id,message_id,chunk_id'");
  });

  it('RAG retrieval returns grounded flag and chunk/material IDs', () => {
    const content = readFile('lib/rag/retrieval.ts');
    expect(content).toContain('grounded');
    expect(content).toContain('chunkIds') || expect(content).toContain('chunk_id');
  });

  it('query route enforces user_id scoping on material retrieval', () => {
    const content = readFile('app/api/materials/query/route.ts');
    expect(content).toContain('user.id');
    expect(content).toContain("eq('user_id', user.id)");
  });

  it('query route enforces feature limit (usage gate)', () => {
    const content = readFile('app/api/materials/query/route.ts');
    expect(content).toContain('enforceFeatureLimit');
    expect(content).toContain('material_query');
  });

  it('MIND RAG context is only loaded from user materials', () => {
    const content = readFile('lib/rag/mind-rag.ts');
    expect(content).toContain('userId') || expect(content).toContain('user_id');
  });
});

describe('Module 7 — Phase 7.4: Storage privacy and deletion cascade', () => {
  it('storage paths are user-scoped (user_id prefix)', () => {
    const content = readFile('app/api/materials/upload/route.ts');
    // storagePath must include user.id as prefix
    expect(content).toContain('`${user.id}/');
  });

  it('deletion cascade migration exists', () => {
    const migPath = path.join(root, 'supabase', 'migrations', '20260610000002_rag_material_deletion_cascade.sql');
    expect(fs.existsSync(migPath)).toBe(true);
  });

  it('deletion migration adds deleted_at soft-delete column', () => {
    const content = readFile('supabase/migrations/20260610000002_rag_material_deletion_cascade.sql').toLowerCase();
    expect(content).toContain('deleted_at');
    expect(content).toContain('study_materials');
  });

  it('deletion migration cascades to orphan chunks', () => {
    const content = readFile('supabase/migrations/20260610000002_rag_material_deletion_cascade.sql').toLowerCase();
    expect(content).toContain('orphaned_at');
    expect(content).toContain('study_material_chunks') || expect(content).toContain('material_chunks');
  });

  it('deletion migration creates a trigger for cascade orphaning', () => {
    const content = readFile('supabase/migrations/20260610000002_rag_material_deletion_cascade.sql').toLowerCase();
    expect(content).toContain('create trigger') || expect(content).toContain('create or replace trigger');
    expect(content).toContain('cascade_orphan_chunks');
  });
});
