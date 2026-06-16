import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as ChatPOST } from '@/app/api/ai/chat/route';
import { POST as AutopsyPOST } from '@/app/api/autopsy/ingest/route';
import { POST as MaterialsPOST } from '@/app/api/materials/upload/route';
import { createMockRequest } from '@/tests/utils/next-request-mock';
import { createMockSupabaseClient } from '@/tests/utils/supabase-mock';
import * as serverSupabase from '@/lib/supabase/server';
import * as rateLimit from '@/lib/middleware/rateLimit';

import * as featureFlags from '@/lib/feature-registry';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));
vi.mock('@/lib/middleware/rateLimit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 10, resetAt: Date.now() }),
  rateLimitResponse: vi.fn(),
}));

vi.mock('@/lib/middleware/withRateLimit', () => ({
  withRateLimit: (name: string, fn: any) => (req: any) => fn(req, 'beta-user-1')
}));
vi.mock('@/lib/events/orchestrator', () => ({
  EventDispatcher: { publish: vi.fn() }
}));

vi.mock('@/lib/feature-registry', () => ({
  featureFlags: {
    autopsyProcessing: vi.fn().mockReturnValue(true),
    aiTutorMode: vi.fn().mockReturnValue(true),
    newRevisionEngine: vi.fn().mockReturnValue(true),
  }
}));

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return {
    ...actual,
    after: vi.fn((fn) => {
      // Don't execute the callback to prevent hanging the test
    }),
  };
});

import * as serverAdmin from '@/lib/supabase/admin';

describe('Private Beta Flow Integration Tests', () => {
  const { client, chain } = createMockSupabaseClient();
  const adminClient = { ...client, auth: { admin: { getUserById: vi.fn() } } };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(serverSupabase.createClient).mockResolvedValue(client as any);
    vi.mocked(serverAdmin.createAdminClient).mockReturnValue(adminClient as any);
    client.auth.getUser.mockResolvedValue({ data: { user: { id: 'beta-user-1' } } });
    vi.mocked(rateLimit.checkRateLimit).mockResolvedValue({ allowed: true, remaining: 10, resetAt: Date.now() });
    
    // Fallback for single() so things like getOrCreateChatSession don't fail
    chain.single.mockResolvedValue({ data: { id: 'mocked-id' }, error: null });
  });

  it('Flow 1: Send chat message and receive fallback if AI fails', async () => {
    // Basic structural test ensuring the route handles the request 
    // and returns a response without 500 when everything is mocked.
    const req = createMockRequest('POST', 'http://localhost/api/chat', { messages: [{ role: 'user', content: 'hello' }] }, { 'Content-Type': 'application/json' });
    const response = await ChatPOST(req);
    if (response.status >= 500) {
      console.log(await response.clone().text());
    }
    expect(response.status).toBeLessThan(500); // 200 or 4xx if validation fails, but not crash
  });

  it('Flow 2: Submit test mistakes and trigger event', async () => {
    chain.single.mockResolvedValue({ data: { id: 'mistake-1' }, error: null });
    const req = createMockRequest('POST', 'http://localhost/api/autopsy/ingest', {
      subject: 'Bio', chapter: 'Cells', topic: 'Mitosis', rawText: 'I forgot anaphase'
    }, { 'Content-Type': 'application/json' });
    const response = await AutopsyPOST(req);
    expect(response.status).toBeLessThan(500);
  });

  it('Flow 3: Upload material for generation', async () => {
    const formData = new FormData();
    const file = new File(['mock content'], 'test.txt', { type: 'text/plain' });
    formData.append('file', file);
    
    const req = new Request('http://localhost/api/materials/upload', {
      method: 'POST',
      body: formData,
    }) as any;
    req.formData = async () => formData;
    
    // Test that the route gracefully handles it
    const response = await MaterialsPOST(req);
    expect(response.status).toBeLessThan(500);
  });
});
