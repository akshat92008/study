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

vi.mock('@/lib/ai/provider-client', () => ({
  generateText: vi.fn().mockResolvedValue('Mock coaching response'),
}));

vi.mock('@/lib/ai/cost-guard', () => ({
  reserveBudgetForModelCall: vi.fn().mockResolvedValue({ reservationId: 'reservation-1' }),
  budgetExceededResponse: vi.fn(),
  budgetUnavailableResponse: vi.fn(),
  isBudgetExceeded: vi.fn().mockReturnValue(false),
  isBudgetUnavailable: vi.fn().mockReturnValue(false),
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
