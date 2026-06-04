import { describe, expect, it } from 'vitest';
import { POST as createAssessment, GET as listAssessments } from '@/app/api/autopsy/v3/assessments/route';
import { POST as generateReport } from '@/app/api/autopsy/v3/assessments/[id]/generate-report/route';

describe('Autopsy V3 routes', () => {
  it('exports create/list assessment handlers', () => {
    expect(typeof createAssessment).toBe('function');
    expect(typeof listAssessments).toBe('function');
  });

  it('exports report generation handler', () => {
    expect(typeof generateReport).toBe('function');
  });
});
