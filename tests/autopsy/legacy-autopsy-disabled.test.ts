import { describe, it, expect } from 'vitest';
import { GET, POST } from '@/app/api/autopsy/route';
import { POST as V3_UPLOAD } from '@/app/api/autopsy/v3/upload/route';
import { createMockRequest } from '../utils/mock-request';

describe('Legacy Autopsy Disabled', () => {
  it('GET /api/autopsy returns 410', async () => {
    const res = await GET();
    expect(res.status).toBe(410);
    const data = await res.json();
    expect(data.error).toBe('legacy_autopsy_disabled');
    expect(data.replacement).toContain('/api/autopsy/v3');
  });

  it('POST /api/autopsy returns 410', async () => {
    const res = await POST();
    expect(res.status).toBe(410);
    const data = await res.json();
    expect(data.error).toBe('legacy_autopsy_disabled');
  });

  it('Autopsy V3 routes remain available', async () => {
    // Just verify the export exists and is a function
    expect(typeof V3_UPLOAD).toBe('function');
  });
});
