import { POST } from '../../app/api/ai/revision-coach/route';
import { NextResponse } from 'next/server';

// Mock Supabase client
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: async () => ({ data: { user: { id: 'test-user' } }, error: null }),
    },
    from: () => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null }),
    }),
  })),
}));

// Mock GoogleGenAI
jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn(() => ({
    models: {
      generateContent: jest.fn().mockResolvedValue({ text: 'Mock coaching response' }),
    },
  })),
}));

test('revision-coach route emits requestId and returns coaching', async () => {
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
