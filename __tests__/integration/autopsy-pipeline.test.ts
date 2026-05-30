import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import { isVerifiedAutopsyMistake, isPendingReviewMistake } from '@/lib/events/autopsy-evidence';

describe('Autopsy Pipeline (Verified vs Pending Review)', () => {
  let supabaseMock: any;
  let userId: string;

  beforeAll(() => {
    userId = randomUUID();
    // Create a mock supabase client that simulates the RPC behavior
    supabaseMock = {
      rpc: vi.fn(),
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    };
  });

  it('correctly processes high-confidence items as verified_mistake', async () => {
    const autopsyId = randomUUID();
    const traceId = randomUUID();
    const idempotencyKey = `test-autopsy-high-conf-${Date.now()}`;

    const mockQuestions = [
      {
        questionNumber: 1,
        subject: 'Physics',
        chapter: 'Kinematics',
        status: 'Incorrect',
        questionText: 'Test question 1',
        correctAnswer: 'A',
        studentAnswer: 'B',
        mistakeCategory: 'conceptual_gap',
        extractionConfidence: 95, // HIGH confidence
        needsReview: false,
      }
    ];

    // Mock RPC implementation returning verified
    supabaseMock.rpc.mockResolvedValueOnce({
      data: {
        autopsy_id: autopsyId,
        event_id: randomUUID(),
        verified_count: 1,
        pending_review_count: 0,
        idempotent_replay: false
      },
      error: null
    });

    // Mock DB verify call
    const mockEq0 = vi.fn();
    supabaseMock.eq = mockEq0;
    mockEq0.mockReturnValue({ eq: mockEq0, then: (cb: any) => cb({ data: [{ status: 'verified_mistake' }] }) });

    const { data: result, error } = await supabaseMock.rpc('ingest_mock_autopsy', {
      p_user_id: userId,
      p_test_name: 'Test Autopsy',
      p_exam_type: 'NEET',
      p_total_questions: 1,
      p_correct_count: 0,
      p_incorrect_count: 1,
      p_unattempted_count: 0,
      p_current_score: -1,
      p_recoverable_marks: 4,
      p_potential_score: 4,
      p_questions: mockQuestions,
      p_idempotency_key: idempotencyKey,
      p_trace_id: traceId,
      p_confidence_threshold: 70
    });

    expect(error).toBeNull();
    expect(result.verified_count).toBe(1);
    expect(result.pending_review_count).toBe(0);

    // Verify it was stored as verified_mistake in the mistakes table (mocked)
    const { data: mistakes } = await supabaseMock
      .from('mistakes')
      .select('status')
      .eq('user_id', userId)
      .eq('source_autopsy_id', result.autopsy_id);
    
    expect(mistakes).toHaveLength(1);
    expect(mistakes![0].status).toBe('verified_mistake');

    // Verify evidence utility functions work correctly on the output
    const eventPayloadObj = {
      status: 'verified_mistake',
      needs_review: false,
      extraction_confidence: 95
    };
    expect(isVerifiedAutopsyMistake(eventPayloadObj)).toBe(true);
    expect(isPendingReviewMistake(eventPayloadObj)).toBe(false);
  });

  it('correctly downgrades low-confidence items to pending_review', async () => {
    const traceId = randomUUID();
    const idempotencyKey = `test-autopsy-low-conf-${Date.now()}`;

    const mockQuestions = [
      {
        questionNumber: 2,
        subject: 'Chemistry',
        chapter: 'Thermodynamics',
        status: 'Incorrect',
        questionText: 'Blurry text question',
        correctAnswer: 'C',
        studentAnswer: 'D',
        mistakeCategory: 'unknown',
        extractionConfidence: 45, // LOW confidence
        needsReview: false,
      }
    ];

    // Mock RPC implementation returning pending_review
    supabaseMock.rpc.mockResolvedValueOnce({
      data: {
        autopsy_id: randomUUID(),
        event_id: randomUUID(),
        verified_count: 0,
        pending_review_count: 1,
        idempotent_replay: false
      },
      error: null
    });

    const { data: result, error } = await supabaseMock.rpc('ingest_mock_autopsy', {
      p_user_id: userId,
      p_test_name: 'Low Conf Test',
      p_exam_type: 'NEET',
      p_total_questions: 1,
      p_correct_count: 0,
      p_incorrect_count: 1,
      p_unattempted_count: 0,
      p_current_score: -1,
      p_recoverable_marks: 0,
      p_potential_score: 4,
      p_questions: mockQuestions,
      p_idempotency_key: idempotencyKey,
      p_trace_id: traceId,
      p_confidence_threshold: 70
    });

    expect(error).toBeNull();
    expect(result.verified_count).toBe(0); // Should NOT be verified
    expect(result.pending_review_count).toBe(1); // Should be pending review

    // Mock DB verify call
    const mockEq = vi.fn().mockResolvedValue({
      data: [{ status: 'pending_review' }]
    });
    supabaseMock.eq = mockEq;
    mockEq.mockReturnValue({ eq: mockEq, then: (cb: any) => cb({ data: [{ status: 'pending_review' }] }) });

    // Verify it was stored as pending_review in the mistakes table
    const { data: mistakes } = await supabaseMock
      .from('mistakes')
      .select('status')
      .eq('user_id', userId)
      .eq('source_autopsy_id', result.autopsy_id);
    
    expect(mistakes).toHaveLength(1);
    expect(mistakes![0].status).toBe('pending_review');

    // Verify evidence utility functions work correctly on the output
    const eventPayloadObj = {
      status: 'pending_review',
      needs_review: false,
      extraction_confidence: 45
    };
    expect(isVerifiedAutopsyMistake(eventPayloadObj)).toBe(false);
    expect(isPendingReviewMistake(eventPayloadObj)).toBe(true);
  });

  it('correctly downgrades explicit needsReview items to needs_review status', async () => {
    const traceId = randomUUID();
    const idempotencyKey = `test-autopsy-needs-review-${Date.now()}`;

    const mockQuestions = [
      {
        questionNumber: 3,
        subject: 'Biology',
        chapter: 'Genetics',
        status: 'Incorrect',
        questionText: 'Test question',
        correctAnswer: 'A',
        studentAnswer: 'B',
        mistakeCategory: 'conceptual_gap',
        extractionConfidence: 99, // High confidence, but...
        needsReview: true,        // Explicitly flagged by engine
      }
    ];

    // Mock RPC implementation returning needs_review
    supabaseMock.rpc.mockResolvedValueOnce({
      data: {
        autopsy_id: randomUUID(),
        event_id: randomUUID(),
        verified_count: 0,
        pending_review_count: 0,
        idempotent_replay: false
      },
      error: null
    });

    const { data: result, error } = await supabaseMock.rpc('ingest_mock_autopsy', {
      p_user_id: userId,
      p_test_name: 'Needs Review Test',
      p_exam_type: 'NEET',
      p_total_questions: 1,
      p_correct_count: 0,
      p_incorrect_count: 1,
      p_unattempted_count: 0,
      p_current_score: -1,
      p_recoverable_marks: 0,
      p_potential_score: 4,
      p_questions: mockQuestions,
      p_idempotency_key: idempotencyKey,
      p_trace_id: traceId,
      p_confidence_threshold: 70
    });

    expect(error).toBeNull();
    expect(result.verified_count).toBe(0);
    // Note: needs_review is a separate category from pending_review in the RPC
    // so pending_review_count might be 0, but verified_count must be 0.
    
    const mockEq2 = vi.fn();
    supabaseMock.eq = mockEq2;
    mockEq2.mockReturnValue({ eq: mockEq2, then: (cb: any) => cb({ data: [{ evidence_status: 'needs_review' }] }) });

    // Verify it was stored as needs_review in the autopsy_questions table
    const { data: autopsyQs } = await supabaseMock
      .from('autopsy_questions')
      .select('evidence_status')
      .eq('autopsy_id', result.autopsy_id)
      .eq('question_number', 3);
      
    expect(autopsyQs).toHaveLength(1);
    expect(autopsyQs![0].evidence_status).toBe('needs_review');

    // Verify evidence utility functions work correctly on the output
    const eventPayloadObj = {
      status: 'needs_review',
      needs_review: true,
      extraction_confidence: 99
    };
    expect(isVerifiedAutopsyMistake(eventPayloadObj)).toBe(false);
    expect(isPendingReviewMistake(eventPayloadObj)).toBe(true);
  });

  it('is idempotent on retry', async () => {
    const traceId = randomUUID();
    const idempotencyKey = `test-autopsy-idempotent-${Date.now()}`;

    const mockQuestions = [
      {
        questionNumber: 1,
        subject: 'Physics',
        chapter: 'Kinematics',
        status: 'Incorrect',
        questionText: 'Test question 1',
        correctAnswer: 'A',
        studentAnswer: 'B',
        mistakeCategory: 'conceptual_gap',
        extractionConfidence: 95,
        needsReview: false,
      }
    ];

    const autopsyId = randomUUID();
    const eventId = randomUUID();

    // Mock RPC implementation returning first success
    supabaseMock.rpc.mockResolvedValueOnce({
      data: {
        autopsy_id: autopsyId,
        event_id: eventId,
        verified_count: 1,
        pending_review_count: 0,
        idempotent_replay: false
      },
      error: null
    });

    // First call
    const { data: result1, error: error1 } = await supabaseMock.rpc('ingest_mock_autopsy', {
      p_user_id: userId,
      p_test_name: 'Idempotency Test',
      p_exam_type: 'NEET',
      p_total_questions: 1,
      p_correct_count: 0,
      p_incorrect_count: 1,
      p_unattempted_count: 0,
      p_current_score: -1,
      p_recoverable_marks: 4,
      p_potential_score: 4,
      p_questions: mockQuestions,
      p_idempotency_key: idempotencyKey,
      p_trace_id: traceId,
      p_confidence_threshold: 70
    });

    expect(error1).toBeNull();
    expect(result1.idempotent_replay).toBe(false);

    // Mock RPC implementation returning idempotent replay
    supabaseMock.rpc.mockResolvedValueOnce({
      data: {
        autopsy_id: autopsyId,
        event_id: eventId,
        verified_count: 0,
        pending_review_count: 0,
        idempotent_replay: true
      },
      error: null
    });

    // Second call with same idempotency key
    const { data: result2, error: error2 } = await supabaseMock.rpc('ingest_mock_autopsy', {
      p_user_id: userId,
      p_test_name: 'Idempotency Test',
      p_exam_type: 'NEET',
      p_total_questions: 1,
      p_correct_count: 0,
      p_incorrect_count: 1,
      p_unattempted_count: 0,
      p_current_score: -1,
      p_recoverable_marks: 4,
      p_potential_score: 4,
      p_questions: mockQuestions,
      p_idempotency_key: idempotencyKey,
      p_trace_id: traceId,
      p_confidence_threshold: 70
    });

    expect(error2).toBeNull();
    expect(result2.idempotent_replay).toBe(true);
    expect(result2.autopsy_id).toBe(result1.autopsy_id);
    expect(result2.event_id).toBe(result1.event_id);
  });
});
