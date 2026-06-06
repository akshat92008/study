import { describe, it, expect } from 'vitest';
import { looksTruncated } from '@/lib/utils/text-completeness';

describe('looksTruncated', () => {
  it('returns false for empty text', () => {
    expect(looksTruncated('')).toBe(false);
  });

  it('returns false for complete sentence', () => {
    expect(looksTruncated('This is a complete sentence.')).toBe(false);
  });

  it('returns true for sentence ending in middle', () => {
    // Should be longer than 500 chars to trigger the length check if no open code fence
    const longIncomplete = 'This is a very long response that goes on and on for a long time without ever reaching a proper conclusion or terminal punctuation'.repeat(10);
    expect(looksTruncated(longIncomplete)).toBe(true);
  });

  it('returns true for unclosed code fence', () => {
    expect(looksTruncated('```javascript\nconst x = 5;')).toBe(true);
  });

  it('returns false for closed code fence', () => {
    expect(looksTruncated('```javascript\nconst x = 5;\n```')).toBe(false);
  });

  it('returns false for short incomplete sentence', () => {
    expect(looksTruncated('Wait for')).toBe(false); // Too short to be sure it's truncated
  });
});
