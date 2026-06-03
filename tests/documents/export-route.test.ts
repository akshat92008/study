// tests/documents/export-route.test.ts
// Tests for the /api/documents/export-pdf route.
// Uses vitest with mocked Next.js and Supabase dependencies.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

// Mock Supabase server client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

// Mock rate limiter (always allow in tests)
vi.mock('@/lib/middleware/rateLimit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({
    allowed: true,
    remaining: 4,
    resetAt: Date.now() + 60000,
    limit: 5,
  }),
  rateLimitResponse: vi.fn(),
}));

// Mock the PDF renderer (return a small buffer instead of real PDF generation)
vi.mock('@/lib/documents/render-document-pdf', () => ({
  renderDocumentPDF: vi.fn().mockReturnValue(Buffer.from('%PDF-1.4 fake-pdf-content')),
  getPDFFilename: vi.fn().mockReturnValue('neet_mock_test.pdf'),
}));

import { createClient } from '@/lib/supabase/server';
import { POST } from '@/app/api/documents/export-pdf/route';
import { NextRequest } from 'next/server';
import type { MockTestDocument } from '@/lib/documents/document-types';

// ── Helpers ───────────────────────────────────────────────────────────────────

const MOCK_USER = { id: 'user_test_123', email: 'test@example.com' };

const SAMPLE_MOCK_TEST: MockTestDocument = {
  id: 'test_001',
  kind: 'mock_test',
  title: 'NEET Mock Test',
  exam: 'NEET',
  createdAt: new Date().toISOString(),
  metadata: { totalQuestions: 1, subjects: ['Physics'], difficulty: 'medium' },
  questions: [{
    id: 'q_1',
    number: 1,
    subject: 'Physics',
    question: 'What is the SI unit of charge?',
    options: { A: 'Ampere', B: 'Coulomb', C: 'Volt', D: 'Ohm' },
    correctAnswer: 'B',
  }],
};

function makeRequest(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost:3000/api/documents/export-pdf', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function mockAuthUser(user: typeof MOCK_USER | null) {
  const mockGetUser = vi.fn().mockResolvedValue({
    data: { user },
    error: user ? null : { message: 'No session' },
  });
  const mockSupabase = { auth: { getUser: mockGetUser } };
  (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockSupabase);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/documents/export-pdf', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 for unauthenticated requests', async () => {
    mockAuthUser(null);

    const req = makeRequest({ document: SAMPLE_MOCK_TEST });
    const res = await POST(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('unauthorized');
  });

  it('returns application/pdf for valid authenticated request', async () => {
    mockAuthUser(MOCK_USER);

    const req = makeRequest({ document: SAMPLE_MOCK_TEST });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    expect(res.headers.get('Content-Disposition')).toContain('.pdf');
  });

  it('returns 400 when document field is missing', async () => {
    mockAuthUser(MOCK_USER);

    const req = makeRequest({});
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('missing_document');
  });

  it('returns 400 for invalid JSON body', async () => {
    mockAuthUser(MOCK_USER);

    const req = new NextRequest('http://localhost:3000/api/documents/export-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'this is not json',
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_json');
  });

  it('returns 400 for invalid document kind', async () => {
    mockAuthUser(MOCK_USER);

    const req = makeRequest({ document: { kind: 'invalid_kind', id: '1', title: 'Test', createdAt: '' } });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_document_kind');
  });

  it('returns 413 when Content-Length exceeds limit', async () => {
    mockAuthUser(MOCK_USER);

    const req = makeRequest({ document: SAMPLE_MOCK_TEST }, {
      'Content-Length': String(200 * 1024), // 200 KB
    });
    const res = await POST(req);

    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body.error).toBe('payload_too_large');
  });
});
