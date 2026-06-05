import { describe, expect, it, vi, afterEach } from 'vitest';
import { detectStalledSources, sourceStatusLabel } from '@/lib/services/source-status.service';

describe('source status service', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('detects stuck queued sources', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-06T10:10:00.000Z'));
    expect(detectStalledSources({
      id: 's1',
      status: 'queued',
      queued_at: '2026-06-06T10:00:00.000Z',
    })).toBe('stalled_queued');
  });

  it('marks exhausted retries as needing user action', () => {
    expect(detectStalledSources({
      id: 's1',
      status: 'processing',
      retry_count: 3,
    })).toBe('needs_user_action');
  });

  it('uses human-readable status labels without LLM', () => {
    expect(sourceStatusLabel('ready', 'active')).toBe('Ready for tutor');
    expect(sourceStatusLabel('failed', 'active')).toBe('Failed, retry available');
  });
});
