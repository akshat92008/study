import { describe, expect, it } from 'vitest';
import { StudentEventInputSchema } from '@/lib/events/schema';

describe('Event Schema', () => {
  it('accepts PRACTICE_ATTEMPT_RECORDED event', () => {
    const event = {
      type: 'PRACTICE_ATTEMPT_RECORDED',
      data: {
        practiceSetId: '123e4567-e89b-12d3-a456-426614174000',
        setType: 'mcq'
      }
    };
    const result = StudentEventInputSchema.safeParse(event);
    expect(result.success).toBe(true);
  });
});
