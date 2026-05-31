import { expect, test } from 'vitest';

test('revision-coach route is disabled for the production MVP', async () => {
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
  expect(response.status).toBe(404);
  const data = await response.json();
  expect(data).toEqual({
    error: 'disabled_for_mvp',
    message: 'This feature is not part of the production MVP.',
  });
});
