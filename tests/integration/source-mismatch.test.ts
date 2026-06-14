import { describe, expect, it } from 'vitest';
import { classifySource } from '@/lib/materials/classify-source';
import { normalizeGoal } from '@/lib/goals/normalize-goal';

describe('source mismatch warning', () => {
  const goal = {
    title: 'Master Biotechnology',
    subject: 'Biology',
    metadata: { normalizedGoal: normalizeGoal('master biotechnology') },
  };

  it('warns for Alternating Current and allows explicit acknowledgement', () => {
    const result = classifySource({
      filename: '12-Phy-NCERT-Book-PDF-Alternating-Current.pdf',
      activeGoal: goal,
    });
    expect(result).toMatchObject({
      detectedSubject: 'Physics',
      detectedChapter: 'Alternating Current',
      goalMatchScore: 0.05,
      mismatch: true,
    });
    expect(result.warningMessage).toContain('Attach anyway?');

    const cancelAttaches = false;
    const attachAnywayPayload = { mismatch_warning_acknowledged: true };
    expect(cancelAttaches).toBe(false);
    expect(attachAnywayPayload.mismatch_warning_acknowledged).toBe(true);
  });

  it('does not warn for a Biotechnology source', () => {
    const result = classifySource({ filename: 'NCERT-Biotechnology-PCR-and-Plasmids.pdf', activeGoal: goal });
    expect(result.detectedSubject).toBe('Biology');
    expect(result.detectedChapter).toBe('Biotechnology');
    expect(result.mismatch).toBe(false);
    expect(result.goalMatchScore).toBeGreaterThan(0.9);
  });
});

