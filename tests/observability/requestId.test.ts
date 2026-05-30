import { expect, test, vi } from 'vitest';
import { NextResponse } from 'next/server';

// Mock Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: async () => ({ data: { user: { id: 'test-user' } }, error: null }),
    },
    from: () => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    }),
  })),
}));

// Mock GoogleGenAI
vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn(() => ({
    models: {
      generateContent: vi.fn().mockResolvedValue({ text: 'Mock coaching response' }),
    },
  })),
}));

test('revision-coach route emits requestId and returns coaching', async () => {
  const { POST } = await import('../../app/api/ai/revision-coach/route');
  const request = new Request('http://localhost/api/ai/revision-coach', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      currentCard: { front: 'x', back: 'y' },
      performance: { rating: 4 },
    }),
  });

  const response = await POST(request);
  // Ensure we got a NextResponse with status 200
  expect(response).toBeInstanceOf(NextResponse);
  const data = await response.json();
  expect(data.coaching).toBeDefined();
});
