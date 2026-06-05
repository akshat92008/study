import { describe, expect, it } from 'vitest';
import { POST } from '@/app/api/autopsy/manual/route';
import { createMockRequest } from '@/tests/utils/next-request-mock';

describe('Manual Autopsy legacy route', () => {
  it('is disabled so legacy Hermes/manual flow cannot bypass Autopsy V3 gates', async () => {
    const req = createMockRequest('POST', 'http://localhost/api/autopsy/manual', {
      question: 'A projectile is thrown at 45 degrees. What is the range?',
      myAnswer: 'v^2/2g',
      correctAnswer: 'v^2 sin(2θ)/g',
    });

    const response = await POST(req);
    const body = await response.json();

    expect(response.status).toBe(410);
    expect(body).toMatchObject({
      error: 'legacy_autopsy_disabled',
      replacement: '/api/autopsy/v3',
      retryable: false,
    });
  });
});
