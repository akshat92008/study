import { describe, expect, it } from 'vitest';
import { PATCH } from '@/app/api/autopsy/questions/[id]/route';

describe('Autopsy Manual Review Route', () => {
  it('exists and is a function', () => {
    expect(typeof PATCH).toBe('function');
  });
});
