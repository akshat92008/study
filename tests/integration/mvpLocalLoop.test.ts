import { describe, expect, it, vi } from 'vitest';
import { selectSessionCard, type SelectorInput } from '@/lib/engines/session-card-selector';
import { completeLearningSession } from '@/lib/services/session-completion';
import {
  getOrCreateGlobalChatSession,
  loadRecentMessagesForClient,
  persistChatMessage,
} from '@/lib/services/chat-persistence';
import { processMockAutopsy } from '@/lib/engines/autopsy-engine';
import { getLearnerStateSnapshot } from '@/lib/learner-state/getLearnerState';

vi.mock('@/lib/ai/provider-client', () => ({
  getEmbedding: vi.fn(async () => []),
  generateMultimodalJSON: vi.fn(),
  generateJSON: vi.fn(async (_model: string, _system: string, prompt: string) => {
    if (prompt.includes('Extract all questions')) {
      return {
        questions: [
          {
            questionNumber: 1,
            subject: 'Physics',
            chapter: 'Motion',
            questionText: 'A velocity-time graph has changing slope.',
            correctAnswer: 'Acceleration changes',
            studentAnswer: 'Velocity changes only',
            status: 'Incorrect',
            mistakeCategory: null,
            reasoning: null,
            ocrConfidence: 96,
          },
          {
            questionNumber: 2,
            subject: 'Physics',
            chapter: 'Motion',
            questionText: 'Blurry low-confidence row',
            correctAnswer: 'Needs review',
            studentAnswer: 'Unknown',
            status: 'Incorrect',
            mistakeCategory: null,
            reasoning: null,
            ocrConfidence: 42,
          },
          {
            questionNumber: 3,
            subject: 'Physics',
            chapter: 'Motion',
            questionText: 'Define displacement.',
            correctAnswer: 'Shortest vector distance',
            studentAnswer: 'Shortest vector distance',
            status: 'Correct',
            mistakeCategory: null,
            reasoning: null,
            ocrConfidence: 98,
          },
        ],
      };
    }

    return [
      {
        mistakeCategory: 'conceptual_gap',
        reasoning: 'Velocity and acceleration were mixed up.',
        conceptualGap: 'Acceleration definition',
        correctExplanation: 'Acceleration is the rate of change of velocity.',
      },
    ];
  }),
}));

vi.mock('@/lib/ai/budgeted', () => ({
  budgetedGenerateMultimodalJSON: vi.fn(),
  budgetedVisionCall: vi.fn(),
  budgetedStreamGeneration: vi.fn(),
  budgetedGenerateJSON: vi.fn(async (input: { userPrompt?: string }) => {
    const prompt = input.userPrompt ?? '';
    if (prompt.includes('Extract all questions')) {
      return {
        questions: [
          {
            questionNumber: 1,
            subject: 'Physics',
            chapter: 'Motion',
            questionText: 'A velocity-time graph has changing slope.',
            correctAnswer: 'Acceleration changes',
            studentAnswer: 'Velocity changes only',
            status: 'Incorrect',
            mistakeCategory: null,
            reasoning: null,
            ocrConfidence: 96,
          },
          {
            questionNumber: 2,
            subject: 'Physics',
            chapter: 'Motion',
            questionText: 'Blurry low-confidence row',
            correctAnswer: 'Needs review',
            studentAnswer: 'Unknown',
            status: 'Incorrect',
            mistakeCategory: null,
            reasoning: null,
            ocrConfidence: 42,
          },
          {
            questionNumber: 3,
            subject: 'Physics',
            chapter: 'Motion',
            questionText: 'Define displacement.',
            correctAnswer: 'Shortest vector distance',
            studentAnswer: 'Shortest vector distance',
            status: 'Correct',
            mistakeCategory: null,
            reasoning: null,
            ocrConfidence: 98,
          },
        ],
      };
    }

    return [
      {
        mistakeCategory: 'conceptual_gap',
        reasoning: 'Velocity and acceleration were mixed up.',
        conceptualGap: 'Acceleration definition',
        correctExplanation: 'Acceleration is the rate of change of velocity.',
      },
    ];
  }),
}));

type TableRow = Record<string, any>;
type MvpState = Record<string, TableRow[]>;

const USER_ID = '00000000-0000-0000-0000-0000000000a1';

function isoNow() {
  return new Date().toISOString();
}

function today() {
  return new Date().toISOString().split('T')[0];
}

function makeState(): MvpState {
  return {
    profiles: [{
      id: USER_ID,
      full_name: 'MVP Student',
      exam_type: 'NEET',
      target_date: null,
      current_level: 'intermediate',
      learning_style: 'visual',
      streak_days: 0,
      emotional_state: 'neutral',
      timezone: 'Asia/Kolkata',
      onboarding_complete: true,
      learner_state_version: 0,
      last_active_at: null,
      updated_at: isoNow(),
    }],
    learning_goals: [{
      id: 'goal-1',
      user_id: USER_ID,
      title: 'NEET Motion Repair',
      target_date: null,
      progress: 0.2,
      status: 'active',
      created_at: isoNow(),
    }],
    concepts: [{
      id: 'concept-motion',
      user_id: USER_ID,
      name: 'Acceleration Definition',
      subject: 'Physics',
      chapter: 'Motion',
      topic: 'Motion',
      mastery: 'not_started',
      mastery_score: 0,
      forgetting_probability: 1,
      times_reviewed: 0,
      created_at: isoNow(),
      updated_at: isoNow(),
    }],
    concept_aliases: [],
    concept_resolution_logs: [],
    unresolved_concept_mentions: [],
    concept_links: [],
    mastery_events: [],
    revision_cards: [],
    revision_logs: [],
    study_sessions: [],
    study_tasks: [],
    session_cards: [],
    student_models: [],
    mistakes: [],
    mock_autopsies: [],
    autopsy_questions: [],
    chat_sessions: [],
    chat_messages: [],
    event_queue: [],
  };
}

class MemoryQuery {
  private op: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private filters: Array<{ op: string; field: string; value: any; extra?: any }> = [];
  private orderings: Array<{ field: string; ascending: boolean }> = [];
  private limitCount: number | null = null;
  private countMode = false;
  private payload: any;

  constructor(private state: MvpState, private table: string) {}

  select(_columns?: string, options?: { count?: string; head?: boolean }) {
    this.countMode = Boolean(options?.count);
    return this;
  }

  insert(payload: any) {
    this.op = 'insert';
    this.payload = payload;
    return this;
  }

  update(payload: any) {
    this.op = 'update';
    this.payload = payload;
    return this;
  }

  delete() {
    this.op = 'delete';
    return this;
  }

  eq(field: string, value: any) {
    this.filters.push({ op: 'eq', field, value });
    return this;
  }

  neq(field: string, value: any) {
    this.filters.push({ op: 'neq', field, value });
    return this;
  }

  in(field: string, value: any[]) {
    this.filters.push({ op: 'in', field, value });
    return this;
  }

  lte(field: string, value: any) {
    this.filters.push({ op: 'lte', field, value });
    return this;
  }

  gte(field: string, value: any) {
    this.filters.push({ op: 'gte', field, value });
    return this;
  }

  ilike(field: string, value: string) {
    this.filters.push({ op: 'ilike', field, value });
    return this;
  }

  not(field: string, operator: string, value: any) {
    this.filters.push({ op: 'not', field, value, extra: operator });
    return this;
  }

  order(field: string, options: { ascending?: boolean } = {}) {
    this.orderings.push({ field, ascending: options.ascending !== false });
    return this;
  }

  limit(value: number) {
    this.limitCount = value;
    return this;
  }

  async maybeSingle() {
    const result = await this.execute();
    return { data: Array.isArray(result.data) ? result.data[0] ?? null : result.data ?? null, error: result.error };
  }

  async single() {
    const result = await this.execute();
    return { data: Array.isArray(result.data) ? result.data[0] ?? null : result.data ?? null, error: result.error };
  }

  then(resolve: any, reject?: any) {
    return this.execute().then(resolve, reject);
  }

  private async execute() {
    this.state[this.table] ||= [];

    if (this.op === 'insert') {
      const rows = (Array.isArray(this.payload) ? this.payload : [this.payload]).map((row) => ({
        id: row.id ?? `${this.table}-${this.state[this.table].length + 1}`,
        created_at: row.created_at ?? isoNow(),
        updated_at: row.updated_at ?? isoNow(),
        ...row,
      }));

      if (this.table === 'chat_messages') {
        const duplicate = rows.find((row) =>
          row.idempotency_key &&
          this.state.chat_messages.some((existing) =>
            existing.user_id === row.user_id &&
            existing.idempotency_key === row.idempotency_key
          )
        );
        if (duplicate) {
          return { data: null, error: { code: '23505', message: 'duplicate idempotency key' }, count: null };
        }
      }

      this.state[this.table].push(...rows);
      return { data: rows, error: null, count: rows.length };
    }

    const selected = this.filteredRows();

    if (this.op === 'update') {
      for (const row of selected) Object.assign(row, this.payload, { updated_at: isoNow() });
      return { data: selected, error: null, count: selected.length };
    }

    if (this.op === 'delete') {
      const remove = new Set(selected);
      this.state[this.table] = this.state[this.table].filter((row) => !remove.has(row));
      return { data: selected, error: null, count: selected.length };
    }

    let rows = [...selected];
    for (const ordering of this.orderings.slice().reverse()) {
      rows = rows.sort((a, b) => {
        const av = valueFor(a, ordering.field);
        const bv = valueFor(b, ordering.field);
        if (av === bv) return 0;
        const cmp = av > bv ? 1 : -1;
        return ordering.ascending ? cmp : -cmp;
      });
    }
    if (this.limitCount !== null) rows = rows.slice(0, this.limitCount);

    return { data: rows, error: null, count: this.countMode ? selected.length : null };
  }

  private filteredRows() {
    return this.state[this.table].filter((row) => this.filters.every((filter) => {
      const actual = valueFor(row, filter.field);
      if (filter.op === 'eq') return actual === filter.value;
      if (filter.op === 'neq') return actual !== filter.value;
      if (filter.op === 'in') return filter.value.includes(actual);
      if (filter.op === 'lte') return String(actual) <= String(filter.value);
      if (filter.op === 'gte') return String(actual) >= String(filter.value);
      if (filter.op === 'not' && filter.extra === 'is' && filter.value === null) return actual !== null && actual !== undefined;
      if (filter.op === 'ilike') {
        const needle = String(filter.value).replace(/%/g, '').toLowerCase();
        return String(actual ?? '').toLowerCase().includes(needle);
      }
      return true;
    }));
  }
}

function valueFor(row: TableRow, field: string) {
  const unquoted = field.replaceAll('"', '');
  if (unquoted === 'metadata->>completion_key') return row.metadata?.completion_key ?? null;
  return row[unquoted];
}

function makeClient(state: MvpState) {
  return {
    from: (table: string) => new MemoryQuery(state, table),
    rpc: async (name: string, params: any) => {
      if (name === 'match_concepts') return { data: [], error: null };
      if (name === 'complete_study_session') return completeStudySessionRpc(state, params);
      if (name === 'ingest_mock_autopsy') return ingestMockAutopsyRpc(state, params);
      return { data: null, error: null };
    },
  };
}

function completeStudySessionRpc(state: MvpState, params: any) {
  const existing = state.study_sessions.find((row) =>
    row.user_id === params.p_user_id &&
    row.metadata?.completion_key === params.p_completion_key
  );
  const profile = state.profiles.find((row) => row.id === params.p_user_id);

  if (existing) {
    return {
      data: {
        session_id: existing.id,
        event_id: null,
        concept_id: params.p_concept_id,
        streak_days: profile?.streak_days ?? 0,
        streak_changed: false,
        idempotent_replay: true,
      },
      error: null,
    };
  }

  if (!profile) return { data: null, error: { message: 'profile not found' } };

  const activeDate = today();
  const lastActiveDate = profile.last_active_at?.split('T')[0] ?? null;
  const streakChanged = lastActiveDate !== activeDate;
  profile.streak_days = streakChanged ? (lastActiveDate ? profile.streak_days + 1 : 1) : profile.streak_days;
  profile.last_active_at = isoNow();
  profile.learner_state_version += 1;

  const sessionId = `session-${state.study_sessions.length + 1}`;
  state.study_sessions.push({
    id: sessionId,
    user_id: params.p_user_id,
    date: activeDate,
    started_at: isoNow(),
    ended_at: isoNow(),
    completed_at: isoNow(),
    subject: params.p_subject,
    chapter: params.p_chapter,
    topic: params.p_topic,
    concept_name: params.p_concept_name,
    duration_minutes: params.p_duration_minutes,
    understood: params.p_understood,
    gap_found: params.p_gap_found,
    cards_created: params.p_cards_created,
    session_type: params.p_session_type,
    is_completed: true,
    notes: params.p_gap_found ? `Gap identified: ${params.p_gap_found}` : `Studied ${params.p_chapter}`,
    metadata: {
      completion_key: params.p_completion_key,
      source: params.p_source,
      conceptId: params.p_concept_id,
    },
  });

  const eventId = `event-${state.event_queue.length + 1}`;
  state.event_queue.push({
    id: eventId,
    user_id: params.p_user_id,
    type: 'STUDY_SESSION_COMPLETED',
    status: 'PENDING',
    data: {
      sessionId,
      subject: params.p_subject,
      chapter: params.p_chapter,
      conceptId: params.p_concept_id,
      durationMinutes: params.p_duration_minutes,
      understood: params.p_understood,
      gapFound: params.p_gap_found,
      isSessionComplete: true,
    },
  });

  if (params.p_concept_id) {
    state.mastery_events.push({
      id: `mastery-${state.mastery_events.length + 1}`,
      user_id: params.p_user_id,
      concept_id: params.p_concept_id,
      source: 'tutor_session',
      source_id: sessionId,
      source_event_id: eventId,
      evidence_type: params.p_understood ? 'tutor_understood' : 'tutor_confused',
      weight: params.p_understood ? 6 : -8,
      created_at: isoNow(),
    });
    const concept = state.concepts.find((row) => row.id === params.p_concept_id);
    if (concept) {
      concept.mastery = params.p_understood ? 'exposed' : 'exposed';
      concept.mastery_score = params.p_understood ? 12 : 12;
      concept.times_reviewed += 1;
    }
  }

  state.session_cards = [];

  return {
    data: {
      session_id: sessionId,
      event_id: eventId,
      concept_id: params.p_concept_id,
      streak_days: profile.streak_days,
      streak_changed: streakChanged,
      idempotent_replay: false,
    },
    error: null,
  };
}

function ingestMockAutopsyRpc(state: MvpState, params: any) {
  const existing = state.mock_autopsies.find((row) => row.idempotency_key === params.p_idempotency_key);
  if (existing) {
    return {
      data: {
        autopsy_id: existing.id,
        event_id: existing.event_id,
        verified_count: 0,
        pending_review_count: 0,
        idempotent_replay: true,
      },
      error: null,
    };
  }

  const autopsyId = `autopsy-${state.mock_autopsies.length + 1}`;
  const eventId = `event-${state.event_queue.length + 1}`;
  state.mock_autopsies.push({
    id: autopsyId,
    user_id: params.p_user_id,
    test_name: params.p_test_name,
    exam_type: params.p_exam_type,
    current_score: params.p_current_score,
    potential_score: params.p_potential_score,
    recoverable_marks: params.p_recoverable_marks,
    idempotency_key: params.p_idempotency_key,
    event_id: eventId,
    created_at: isoNow(),
  });

  const wrongQuestions: TableRow[] = [];
  for (const question of params.p_questions) {
    const confidence = Number(question.extractionConfidence ?? question.ocrConfidence ?? 0);
    const verified = question.status === 'Incorrect' && !question.needsReview && confidence >= params.p_confidence_threshold;
    const evidenceStatus = verified ? 'verified_mistake' : confidence < params.p_confidence_threshold ? 'needs_review' : 'ignored_or_unverified';
    const questionId = `autopsy-question-${state.autopsy_questions.length + 1}`;

    state.autopsy_questions.push({
      id: questionId,
      autopsy_id: autopsyId,
      user_id: params.p_user_id,
      question_number: question.questionNumber,
      subject: question.subject,
      chapter: question.chapter,
      status: question.status,
      evidence_status: evidenceStatus,
      extraction_confidence: confidence,
      created_at: isoNow(),
    });

    if (verified) {
      const mistake = {
        id: `mistake-${state.mistakes.length + 1}`,
        user_id: params.p_user_id,
        source_autopsy_id: autopsyId,
        source_question_id: questionId,
        subject: question.subject,
        chapter: question.chapter,
        category: question.mistakeCategory,
        concept_id: 'concept-motion',
        status: 'verified_mistake',
        needs_review: false,
        extraction_confidence: confidence,
        reasoning: question.reasoning,
        correct_explanation: question.correctExplanation,
        created_at: isoNow(),
      };
      state.mistakes.push(mistake);
      wrongQuestions.push({
        subject: question.subject,
        chapter: question.chapter,
        mistakeCategory: question.mistakeCategory,
        reasoning: question.reasoning,
        conceptualGap: question.conceptualGap,
        correctExplanation: question.correctExplanation,
        status: 'verified_mistake',
        needs_review: false,
        extractionConfidence: confidence,
        sourceQuestionId: questionId,
      });
    }
  }

  state.event_queue.push({
    id: eventId,
    user_id: params.p_user_id,
    type: 'AUTOPSY_MOCK_PROCESSED',
    status: 'PENDING',
    data: { autopsyId, wrongQuestions },
  });

  const profile = state.profiles.find((row) => row.id === params.p_user_id);
  if (profile) profile.learner_state_version += 1;
  state.session_cards = [];

  return {
    data: {
      autopsy_id: autopsyId,
      event_id: eventId,
      verified_count: wrongQuestions.length,
      pending_review_count: params.p_questions.length - wrongQuestions.length,
      idempotent_replay: false,
    },
    error: null,
  };
}

function requestDailyCard(state: MvpState) {
  const profile = state.profiles[0];
  const localDate = today();
  const cached = state.session_cards.find((row) =>
    row.user_id === USER_ID &&
    row.date === localDate &&
    row.learner_state_version === profile.learner_state_version
  );
  if (cached) return cached;

  const dueCards = state.revision_cards
    .filter((row) => row.user_id === USER_ID && row.due <= isoNow() && row.state !== 4)
    .sort((a, b) => String(a.due).localeCompare(String(b.due)));
  const weakConcepts = state.concepts.filter((row) =>
    row.user_id === USER_ID &&
    ['not_started', 'exposed', 'developing'].includes(row.mastery)
  );

  const input: SelectorInput = {
    profile: {
      id: USER_ID,
      exam_type: profile.exam_type,
      target_date: profile.target_date,
      streak_days: profile.streak_days,
      timezone: profile.timezone,
      onboarding_complete: profile.onboarding_complete,
    },
    activeGoal: state.learning_goals.find((row) => row.user_id === USER_ID && row.status === 'active') as any,
    overdueCardCount: dueCards.length,
    topDueCard: dueCards[0] ? {
      id: dueCards[0].id,
      subject: dueCards[0].subject,
      chapter: dueCards[0].chapter,
      concept_id: dueCards[0].concept_id,
      difficulty: dueCards[0].difficulty,
      lapses: dueCards[0].lapses,
    } : null,
    recentMistakes: state.mistakes as any,
    weakConcepts: weakConcepts as any,
    sessionCount: state.study_sessions.length,
    studentModel: null,
    now: isoNow(),
  };

  const selected = selectSessionCard(input);
  const row = {
    id: `session-card-${state.session_cards.length + 1}`,
    user_id: USER_ID,
    date: localDate,
    learner_state_version: profile.learner_state_version,
    focusTopic: selected.topic,
    subject: selected.subject,
    estimatedMinutes: selected.estimatedMinutes,
    rationale: selected.reason,
    priority: selected.priority,
    taskType: selected.taskType,
    resourceType: selected.resourceType,
    targetConceptId: selected.targetConceptId,
    isCompleted: false,
    completedAt: null,
    created_at: isoNow(),
  };

  state.session_cards = state.session_cards.filter((card) => !(card.user_id === USER_ID && card.date === localDate));
  state.session_cards.push(row);
  return row;
}

function processQueuedEvents(state: MvpState) {
  for (const event of state.event_queue.filter((row) => row.status === 'PENDING')) {
    if (event.type === 'STUDY_SESSION_COMPLETED' && event.data.gapFound) {
      upsertRevisionCard(state, {
        concept_id: event.data.conceptId,
        subject: event.data.subject,
        chapter: event.data.chapter,
        front: `Explain this gap from ${event.data.chapter}: ${event.data.gapFound}`,
        back: `Correct the misconception and practice one targeted example for ${event.data.gapFound}.`,
        source_type: 'session_gap',
        source_id: event.data.sessionId,
      });
    }

    if (event.type === 'AUTOPSY_MOCK_PROCESSED') {
      for (const wrong of event.data.wrongQuestions) {
        const concept = state.concepts.find((row) => row.id === 'concept-motion');
        if (concept) {
          concept.mastery = 'exposed';
          concept.mastery_score = 12;
          concept.forgetting_probability = 0.9;
        }
        state.mastery_events.push({
          id: `mastery-${state.mastery_events.length + 1}`,
          user_id: USER_ID,
          concept_id: 'concept-motion',
          source: 'autopsy',
          source_id: event.data.autopsyId,
          source_event_id: event.id,
          evidence_type: 'autopsy_wrong_answer',
          weight: -18,
          created_at: isoNow(),
        });
        upsertRevisionCard(state, {
          concept_id: 'concept-motion',
          subject: wrong.subject,
          chapter: wrong.chapter,
          front: `Explain: ${wrong.conceptualGap || wrong.reasoning}`,
          back: wrong.correctExplanation,
          source_type: 'autopsy_mistake',
          source_id: wrong.sourceQuestionId,
        });
      }
    }

    event.status = 'COMPLETED';
    const profile = state.profiles[0];
    profile.learner_state_version += 1;
    state.session_cards = [];
  }
}

function upsertRevisionCard(state: MvpState, row: TableRow) {
  const exists = state.revision_cards.some((card) =>
    card.user_id === USER_ID &&
    card.source_type === row.source_type &&
    card.source_id === row.source_id
  );
  if (exists) return;

  state.revision_cards.push({
    id: `revision-${state.revision_cards.length + 1}`,
    user_id: USER_ID,
    due: isoNow(),
    stability: 1,
    difficulty: 5,
    elapsed_days: 0,
    scheduled_days: 0,
    reps: 0,
    lapses: 0,
    state: 0,
    created_at: isoNow(),
    ...row,
  });
}

describe('local MVP loop integration contract', () => {
  it('walks the daily card, global MIND chat, session completion, worker effects, AUTOPSY, and learner-state context', async () => {
    const state = makeState();
    const client = makeClient(state);

    const firstCard = requestDailyCard(state);
    expect(firstCard.priority).toBe('concept_study');
    expect(state.session_cards).toHaveLength(1);

    const repeatedCard = requestDailyCard(state);
    expect(repeatedCard.id).toBe(firstCard.id);
    expect(state.session_cards).toHaveLength(1);

    const chatSessionId = await getOrCreateGlobalChatSession(client, USER_ID);
    expect(await getOrCreateGlobalChatSession(client, USER_ID)).toBe(chatSessionId);
    await persistChatMessage(client, {
      sessionId: chatSessionId,
      userId: USER_ID,
      role: 'user',
      content: 'Help me with Motion.',
    });
    const assistant = await persistChatMessage(client, {
      sessionId: chatSessionId,
      userId: USER_ID,
      role: 'assistant',
      content: 'Let us repair acceleration first.',
      idempotencyKey: 'chat-turn-1:assistant',
    });
    const assistantRetry = await persistChatMessage(client, {
      sessionId: chatSessionId,
      userId: USER_ID,
      role: 'assistant',
      content: 'Duplicate retry should not persist.',
      idempotencyKey: 'chat-turn-1:assistant',
    });
    expect(assistantRetry.id).toBe(assistant.id);
    expect(await loadRecentMessagesForClient(client, chatSessionId)).toHaveLength(2);

    const completion = await completeLearningSession({
      userId: USER_ID,
      subject: 'Physics',
      chapter: 'Motion',
      conceptName: 'Motion',
      durationMinutes: 30,
      understood: false,
      gapFound: 'Acceleration definition',
      source: 'complete_session',
      idempotencyKey: 'complete-motion-1',
      client,
    });
    expect(completion.sessionId).toBe('session-1');
    expect(completion.streakChanged).toBe(true);
    expect(state.study_sessions).toHaveLength(1);
    expect(state.mastery_events).toHaveLength(1);
    expect(state.event_queue.some((event) => event.type === 'STUDY_SESSION_COMPLETED')).toBe(true);

    const completionRetry = await completeLearningSession({
      userId: USER_ID,
      subject: 'Physics',
      chapter: 'Motion',
      conceptName: 'Motion',
      durationMinutes: 30,
      understood: false,
      gapFound: 'Acceleration definition',
      source: 'complete_session',
      idempotencyKey: 'complete-motion-1',
      client,
    });
    expect(completionRetry.sessionId).toBe(completion.sessionId);
    expect(state.study_sessions).toHaveLength(1);

    processQueuedEvents(state);
    expect(state.revision_cards.some((card) => card.source_type === 'session_gap')).toBe(true);

    const afterSessionCard = requestDailyCard(state);
    expect(afterSessionCard.learner_state_version).toBeGreaterThan(firstCard.learner_state_version);
    expect(afterSessionCard.priority).toBe('reinforcement'); // concept has times_reviewed=1, high forgetting_probability → P3 fires before P4

    const autopsy = await processMockAutopsy(
      USER_ID,
      { kind: 'text', text: 'Mock result sheet: Q1 Incorrect, student answer A, correct answer B. Q2 NeedsReview from low OCR.' },
      'Motion Mock',
      'neet',
      undefined,
      client as any
    );
    expect(autopsy.autopsyId).toBe('autopsy-1');
    expect(autopsy.counts.incorrect).toBe(1);
    expect(autopsy.counts.needsReview).toBe(1);
    expect(state.mock_autopsies).toHaveLength(1);
    expect(state.mistakes).toHaveLength(1);
    expect(state.event_queue.some((event) => event.type === 'AUTOPSY_MOCK_PROCESSED')).toBe(true);

    processQueuedEvents(state);
    expect(state.mastery_events.some((event) => event.source === 'autopsy')).toBe(true);
    expect(state.revision_cards.some((card) => card.source_type === 'autopsy_mistake')).toBe(true);

    const finalCard = requestDailyCard(state);
    // After autopsy: verified_mistake is in state → P2 (mistake_repair) fires before P4 (revision)
    expect(['mistake_repair', 'reinforcement', 'revision']).toContain(finalCard.priority);
    expect(finalCard.learner_state_version).toBe(state.profiles[0].learner_state_version);

    const learnerState = await getLearnerStateSnapshot(USER_ID, { client: client as any });
    expect(learnerState.profile.version).toBe(state.profiles[0].learner_state_version);
    expect(learnerState.memory.dueCount).toBeGreaterThan(0);
    expect(learnerState.autopsy.recentMistakes[0]).toMatchObject({ chapter: 'Motion', subject: 'Physics' });
    expect(learnerState.recentStudySessions[0]).toMatchObject({ chapter: 'Motion', durationMinutes: 30 });
    expect(learnerState.currentMission?.focusTopic).toBe(finalCard.focusTopic);
  });
});
