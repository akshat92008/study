import { describe, expect, it } from 'vitest';
import { writeHermesMemories } from '@/lib/autopsy-v3/hermes-memory-writer';

describe('Autopsy V3 Hermes memory writer', () => {
  it('increments evidence count when similar memory exists', async () => {
    const existing = {
      id: 'memory-1',
      user_id: 'user-1',
      memory_type: 'behavior_pattern',
      subject: 'Physics',
      topic: 'Optics',
      pattern: 'misread question in Physics / Optics',
      evidence_count: 2,
      severity: 'medium',
      confidence: 0.7,
      source_refs: [],
      status: 'active',
    };
    const updates: any[] = [];
    const supabase = {
      from(table: string) {
        expect(table).toBe('hermes_learning_memories');
        return {
          select() { return this; },
          eq() { return this; },
          limit() { return Promise.resolve({ data: [existing], error: null }); },
          update(payload: any) {
            updates.push(payload);
            return {
              eq() { return this; },
              select() { return this; },
              single() { return Promise.resolve({ data: { ...existing, ...payload }, error: null }); },
            };
          },
          insert() {
            throw new Error('insert should not be called');
          },
        };
      },
    };

    const report: any = {
      hermesMemoryCandidates: [{
        subject: 'Physics',
        topic: 'Optics',
        mistakeType: 'misread_question',
        memoryType: 'behavior_pattern',
        rootCause: 'Missed NOT',
        count: 2,
        priorEvidenceCount: 0,
        severity: 'high',
        confidence: 0.82,
        preventionRule: 'Underline NOT.',
        sourceQuestionIds: ['q1', 'q2'],
      }],
    };

    const written = await writeHermesMemories({ supabase, userId: 'user-1', assessmentId: 'assessment-1', report, maxWrites: 1 });
    expect(written[0].evidence_count).toBe(4);
    expect(updates[0].severity).toBe('high');
  });
});
