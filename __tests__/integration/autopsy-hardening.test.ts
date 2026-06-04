import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { randomUUID } from 'crypto';
import { processAutopsyJob, createAutopsyJob } from '@/lib/services/autopsy-jobs';
import { AutopsyNeedsUserInputError, AutopsyExtractionError } from '@/lib/engines/autopsy-engine';
import { createAdminClient } from '@/lib/supabase/admin';

// Mock dependencies
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

vi.mock('@/lib/engines/autopsy-engine', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/engines/autopsy-engine')>();
  return {
    ...actual,
    processMockAutopsy: vi.fn(),
  };
});

vi.mock('@/lib/ai/cost-guard', () => ({
  reserveBudgetForModelCall: vi.fn().mockResolvedValue({ reservationId: 'test-res' }),
  commitBudgetUsage: vi.fn().mockResolvedValue(true),
  releaseBudgetReservation: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/utils/billing', () => ({
  consumeUsageLimit: vi.fn().mockResolvedValue({ allowed: true }),
}));

vi.mock('@/lib/events/orchestrator', () => ({
  EventDispatcher: {
    publish: vi.fn().mockResolvedValue(true),
  },
}));

describe('Autopsy Hardening Integration', () => {
  let supabaseMock: any;
  let userId: string;

  beforeEach(() => {
    userId = randomUUID();
    vi.clearAllMocks();
    
    supabaseMock = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(),
      single: vi.fn(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      storage: {
        from: vi.fn().mockReturnValue({
          upload: vi.fn().mockResolvedValue({ error: null }),
          download: vi.fn().mockResolvedValue({ data: new Blob(['test']), error: null }),
        }),
      },
      rpc: vi.fn().mockResolvedValue({ data: null, error: null })
    };
    
    (createAdminClient as any).mockReturnValue(supabaseMock);
  });

  it('valid data produces mistakes and completes job', async () => {
    const jobId = randomUUID();
    
    supabaseMock.maybeSingle.mockResolvedValueOnce({
      data: {
        id: jobId,
        user_id: userId,
        status: 'queued',
        payload: { fileData: { kind: 'text', text: '1. What is gravity? Ans: C' } }
      }
    });

    supabaseMock.single.mockResolvedValueOnce({
      data: { id: jobId, status: 'completed', result_autopsy_id: 'auto-123' }
    });

    const { processMockAutopsy } = await import('@/lib/engines/autopsy-engine');
    (processMockAutopsy as any).mockResolvedValueOnce({
      autopsyId: 'auto-123',
      needsReviewQuestions: []
    });

    const result = await processAutopsyJob(userId, jobId);

    expect(result).toBeDefined();
    expect(result?.status).toBe('completed');
    expect(result?.result_autopsy_id).toBe('auto-123');
    expect(supabaseMock.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'completed' }));
  });

  it('ambiguous data asks clarification (needs_user_input)', async () => {
    const jobId = randomUUID();
    
    supabaseMock.maybeSingle.mockResolvedValueOnce({
      data: {
        id: jobId,
        user_id: userId,
        status: 'queued',
        payload: { fileData: { kind: 'text', text: 'Test without answers' } }
      }
    });

    supabaseMock.single.mockResolvedValueOnce({
      data: { id: jobId, status: 'needs_user_input', error_message: 'Needs answers' }
    });

    const { processMockAutopsy } = await import('@/lib/engines/autopsy-engine');
    (processMockAutopsy as any).mockRejectedValueOnce(new AutopsyNeedsUserInputError('Needs answers'));

    const result = await processAutopsyJob(userId, jobId);

    expect(result?.status).toBe('needs_user_input');
    expect(result?.error_message).toBe('Needs answers');
    expect(supabaseMock.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'needs_user_input' }));
  });

  it('failed extraction is visible and transitions to failed', async () => {
    const jobId = randomUUID();
    
    supabaseMock.maybeSingle.mockResolvedValueOnce({
      data: {
        id: jobId,
        user_id: userId,
        status: 'queued',
        retry_count: 0,
        payload: { fileData: { kind: 'text', text: 'Garbage data' } }
      }
    });

    const { processMockAutopsy } = await import('@/lib/engines/autopsy-engine');
    (processMockAutopsy as any).mockRejectedValueOnce(new AutopsyExtractionError('Extraction failed'));

    await expect(processAutopsyJob(userId, jobId)).rejects.toThrow('Extraction failed');
    
    // Check it updated to failed with retry_count incremented
    expect(supabaseMock.update).toHaveBeenCalledWith(expect.objectContaining({ 
      status: 'failed', 
      retry_count: 1 
    }));
  });

  it('retry works and transitions to dead_letter after max retries', async () => {
    const jobId = randomUUID();
    
    supabaseMock.maybeSingle.mockResolvedValueOnce({
      data: {
        id: jobId,
        user_id: userId,
        status: 'failed',
        retry_count: 2, // Next fail should be > 2 -> dead_letter
        payload: { fileData: { kind: 'text', text: 'Garbage data' } }
      }
    });

    const { processMockAutopsy } = await import('@/lib/engines/autopsy-engine');
    (processMockAutopsy as any).mockRejectedValueOnce(new Error('Internal error'));

    await expect(processAutopsyJob(userId, jobId)).rejects.toThrow('Internal error');
    
    expect(supabaseMock.update).toHaveBeenCalledWith(expect.objectContaining({ 
      status: 'dead_letter', 
      retry_count: 3 
    }));
  });

  it('duplicate worker run does not duplicate mistakes (idempotent)', async () => {
    // createAutopsyJob checks if idempotencyKey exists
    supabaseMock.maybeSingle.mockResolvedValueOnce({
      data: {
        id: 'existing-job',
        status: 'completed'
      }
    });

    const result = await createAutopsyJob({
      userId,
      fileData: { kind: 'text', text: '1. What is gravity? Ans: C' },
      testName: 'Mock 1',
      examType: 'NEET',
      idempotencyKey: 'same-key'
    });

    // Should return existing job, not insert
    expect(result.id).toBe('existing-job');
    expect(supabaseMock.insert).not.toHaveBeenCalled();
  });
  
  it('cross-user access denied via Row Level Security (handled in DB layer, mocking error)', async () => {
    // We mock that the DB returns nothing for this user because they don't own it
    const jobId = randomUUID();
    
    supabaseMock.maybeSingle.mockResolvedValueOnce({
      data: null, // Simulate RLS blocking read
      error: null
    });

    const result = await processAutopsyJob(userId, jobId);
    expect(result).toBeNull(); // job not found
  });
});
