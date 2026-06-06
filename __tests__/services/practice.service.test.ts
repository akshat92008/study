import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PracticeService, PracticeSetData } from '@/lib/services/practice.service';
import { createAdminClient } from '@/lib/supabase/admin';

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

describe('PracticeService', () => {
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({ data: { id: 'set-123' }, error: null }),
    };
    (createAdminClient as any).mockReturnValue(mockSupabase);
    vi.clearAllMocks();
  });

  it('extracts MCQs and saves to database', async () => {
    const text = `
Here is your test.
<artifact type="practice-test" topic="Cell Biology" subject="Biology">
Q1. What is the powerhouse of the cell?
(A) Mitochondria
(B) Nucleus
(C) Ribosome
(D) Endoplasmic Reticulum
ANSWER: A
EXPLANATION: Mitochondria produce ATP.
---
Q2. Which organelle contains genetic material?
(A) Mitochondria
(B) Nucleus
(C) Ribosome
(D) Endoplasmic Reticulum
ANSWER: B
EXPLANATION: The nucleus stores DNA.
</artifact>
    `;

    const data: PracticeSetData = {
      userId: 'user-1',
      chatSessionId: 'session-1',
      messageId: 'msg-1',
      fullResponse: text
    };

    const result = await PracticeService.extractAndStorePracticeArtifacts(mockSupabase, data);
    expect(result.practiceSetIds).toEqual(['set-123']);
    
    expect(mockSupabase.from).toHaveBeenCalledWith('practice_sets');
    expect(mockSupabase.insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      chat_session_id: 'session-1',
      goal_id: null,
      message_id: 'msg-1',
      topic: 'Cell Biology',
      subject: 'Biology',
      set_type: 'mcq',
      source: 'mind'
    });

    expect(mockSupabase.from).toHaveBeenCalledWith('practice_items');
    expect(mockSupabase.insert).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({
        question: 'What is the powerhouse of the cell?',
        options: ['Mitochondria', 'Nucleus', 'Ribosome', 'Endoplasmic Reticulum'],
        correct_answer: 'A',
        explanation: 'Mitochondria produce ATP.',
      }),
      expect.objectContaining({
        question: 'Which organelle contains genetic material?',
        correct_answer: 'B'
      })
    ]));
  });

  it('extracts flashcards and saves to database', async () => {
    const text = `
<artifact type="flashcard-set" topic="Cell Biology" subject="Biology">
FRONT: What is the powerhouse of the cell?
BACK: Mitochondria
---
FRONT: Which organelle contains genetic material?
BACK: Nucleus
</artifact>
    `;

    const data: PracticeSetData = {
      userId: 'user-1',
      fullResponse: text
    };

    const result = await PracticeService.extractAndStorePracticeArtifacts(mockSupabase, data);
    expect(result.flashcardSetIds).toEqual(['set-123']);
    
    expect(mockSupabase.from).toHaveBeenCalledWith('practice_sets');
    expect(mockSupabase.insert).toHaveBeenCalledWith(expect.objectContaining({
      set_type: 'flashcard'
    }));

    expect(mockSupabase.from).toHaveBeenCalledWith('practice_items');
    expect(mockSupabase.insert).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({
        question: 'What is the powerhouse of the cell?',
        correct_answer: 'Mitochondria'
      })
    ]));
  });

  it('ignores text without artifacts', async () => {
    const text = 'Just a normal chat message without any practice artifacts.';
    const data: PracticeSetData = { userId: 'user-1', fullResponse: text };
    await PracticeService.extractAndStorePracticeArtifacts(mockSupabase, data);
    
    expect(mockSupabase.insert).not.toHaveBeenCalled();
  });
});
