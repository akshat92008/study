import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/materials/upload/route';
import { NextRequest } from 'next/server';
import { createMockSupabaseClient } from '@/tests/utils/supabase-mock';
import * as serverSupabase from '@/lib/supabase/server';
import * as rateLimit from '@/lib/middleware/rateLimit';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/middleware/rateLimit', () => ({
  checkRateLimit: vi.fn(),
  rateLimitResponse: vi.fn(),
}));

function createMockFormDataRequest(file: File | null) {
  const formData = new FormData();
  if (file) {
    formData.append('file', file);
  }
  const req = new NextRequest('http://localhost/api/materials/upload', {
    method: 'POST',
  });
  req.formData = async () => formData;
  return req;
}

describe('Upload Validation Security', () => {
  const { client } = createMockSupabaseClient();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(serverSupabase.createClient).mockResolvedValue(client as any);
    client.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-123' } } });
    vi.mocked(rateLimit.checkRateLimit).mockResolvedValue({ allowed: true, remaining: 10, resetAt: Date.now() });
  });

  it('rejects upload without a file', async () => {
    const req = createMockFormDataRequest(null);
    const response = await POST(req);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('invalid_file');
  });

  it('rejects upload with unsupported file type', async () => {
    const file = new File(['fake content'], 'test.exe', { type: 'application/x-msdownload' });
    const req = createMockFormDataRequest(file);
    const response = await POST(req);

    expect(response.status).toBe(415);
    const data = await response.json();
    expect(data.error).toBe('unsupported_file_type');
  });

  it('rejects upload with oversized file', async () => {
    const maxBytes = 50 * 1024 * 1024 + 1; // Over 50MB
    const bigBuffer = new ArrayBuffer(maxBytes);
    const file = new File([bigBuffer], 'big.pdf', { type: 'application/pdf' });
    const req = createMockFormDataRequest(file);
    const response = await POST(req);

    expect(response.status).toBe(413);
    const data = await response.json();
    expect(data.error).toBe('file_too_large');
  });
});
