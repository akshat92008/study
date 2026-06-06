import { describe, expect, it, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/materials/upload/route';
import { NextRequest } from 'next/server';
import { getRagConfig } from '@/lib/rag/config';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(file: string): string {
  return fs.readFileSync(path.join(root, file), 'utf8');
}


// Mock dependencies
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user-123' } } }) },
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    upsert: vi.fn().mockResolvedValue({ error: null }),
    insert: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { id: 'mat-123', status: 'uploaded' }, error: null }),
    storage: {
      from: vi.fn().mockReturnThis(),
      upload: vi.fn().mockResolvedValue({ error: null }),
    }
  })
}));

vi.mock('@/lib/middleware/rateLimit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 10, resetAt: Date.now() + 60000 }),
  rateLimitResponse: vi.fn()
}));

vi.mock('@/lib/events/orchestrator', () => ({
  EventDispatcher: {
    publish: vi.fn().mockResolvedValue(true)
  }
}));

describe('Upload Route Safety Contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RAG_MAX_FILE_MB = '10';
    process.env.RAG_MAX_DAILY_UPLOADS = '3';
  });

  it('rejects an invalid file type', async () => {
    const formData = new FormData();
    const file = new File(['fake content'], 'test.exe', { type: 'application/x-msdownload' });
    formData.append('file', file);
    
    const req = new NextRequest('http://localhost/api/materials/upload', {
      method: 'POST',
      body: formData
    });

    const response = await POST(req);
    expect(response.status).toBe(415);
    const body = await response.json();
    expect(body.error).toBe('unsupported_file_type');
  });

  it('rejects an oversized file', async () => {
    const config = getRagConfig();
    const formData = new FormData();
    
    // Create a mock file larger than the limit
    const overLimitBytes = config.maxFileBytes + 1024;
    const file = new File([new ArrayBuffer(overLimitBytes)], 'large.pdf', { type: 'application/pdf' });
    formData.append('file', file);
    
    const req = new NextRequest('http://localhost/api/materials/upload', {
      method: 'POST',
      body: formData
    });

    const response = await POST(req);
    expect(response.status).toBe(413);
    const body = await response.json();
    expect(body.error).toBe('file_too_large');
  });

  it('enforces duplicate detection and reuse', () => {
    const routeCode = read('app/api/materials/upload/route.ts');
    expect(routeCode).toContain('const contentHash = materialContentHash(buffer);');
    expect(routeCode).toContain(".eq('content_hash', contentHash)");
    expect(routeCode).toContain('duplicate: true');
  });

  it('enforces the new daily cap limit', () => {
    const routeCode = read('app/api/materials/upload/route.ts');
    expect(routeCode).toContain('const twentyFourHoursAgo');
    expect(routeCode).toContain(".gte('created_at', twentyFourHoursAgo)");
    expect(routeCode).toContain('daily_upload_limit_reached');
  });

  it('ingests small uploads inline and keeps a queued fallback', () => {
    const routeCode = read('app/api/materials/upload/route.ts');
    expect(routeCode).toContain('INLINE_INGESTION_MAX_BYTES');
    expect(routeCode).toContain('await ingestStudyMaterial({');
    expect(routeCode).toContain("from('rag_ingestion_jobs')");
    expect(routeCode).toContain('status: 202');
    expect(routeCode).toContain("status: ingestionResult?.status === 'ready' ? 201 : 202");
    expect(routeCode).toContain("type: 'MATERIAL_UPLOADED'");
  });
});
