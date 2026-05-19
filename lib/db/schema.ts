import {
  pgTable, uuid, text, timestamp, integer, real, boolean, jsonb, pgEnum, vector,
} from 'drizzle-orm/pg-core';

// ---- ENUMS ----
export const masteryEnum = pgEnum('mastery_level', [
  'not_started', 'exposed', 'developing', 'proficient', 'mastered', 'automated',
]);
export const confidenceEnum = pgEnum('confidence_level', [
  'very_low', 'low', 'medium', 'high', 'very_high',
]);
export const mistakeCategoryEnum = pgEnum('mistake_category', [
  'conceptual', 'calculation', 'silly', 'time_pressure', 'misread',
  'incomplete_knowledge', 'overconfidence', 'anxiety', 'recall_failure',
]);
export const emotionalStateEnum = pgEnum('emotional_state', [
  'focused', 'motivated', 'stressed', 'burnt_out', 'anxious',
  'frustrated', 'confident', 'overwhelmed', 'bored', 'neutral',
]);
export const taskTypeEnum = pgEnum('task_type', [
  'study', 'revision', 'practice', 'mock_test', 'break', 'review',
]);
export const taskPriorityEnum = pgEnum('task_priority', [
  'critical', 'high', 'medium', 'low',
]);

// ---- TABLES ----

// Student profiles (extends Supabase auth.users)
export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(), // matches auth.users.id
  fullName: text('full_name').notNull(),
  email: text('email').notNull(),
  examType: text('exam_type').default('CUSTOM'),
  targetYear: integer('target_year'),
  examDate: timestamp('exam_date'),
  targetScore: integer('target_score'),
  currentScore: integer('current_score'),
  studyHoursPerDay: integer('study_hours_per_day').default(8),
  emotionalState: emotionalStateEnum('emotional_state').default('neutral'),
  onboardingComplete: boolean('onboarding_complete').default(false),
  streakDays: integer('streak_days').default(0),
  stripeCustomerId: text('stripe_customer_id'),
  subscriptionStatus: text('subscription_status').default('free'),
  lastActiveAt: timestamp('last_active_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Concept nodes in the cognition graph
export const concepts = pgTable('concepts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => profiles.id).notNull(),
  name: text('name').notNull(),
  subject: text('subject').notNull(),
  chapter: text('chapter').notNull(),
  topic: text('topic').default(''),
  mastery: masteryEnum('mastery').default('not_started'),
  confidence: confidenceEnum('confidence').default('low'),
  lastReviewedAt: timestamp('last_reviewed_at'),
  timesReviewed: integer('times_reviewed').default(0),
  timesCorrect: integer('times_correct').default(0),
  timesIncorrect: integer('times_incorrect').default(0),
  forgettingProbability: real('forgetting_probability').default(1.0),
  retentionStrength: real('retention_strength').default(0.0),
  embedding: vector('embedding', { dimensions: 768 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Links between concepts (cognition graph edges)
export const conceptLinks = pgTable('concept_links', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => profiles.id).notNull(),
  sourceConceptId: uuid('source_concept_id').references(() => concepts.id).notNull(),
  targetConceptId: uuid('target_concept_id').references(() => concepts.id).notNull(),
  linkType: text('link_type').default('prerequisite'), // prerequisite, related, confusion
  strength: real('strength').default(0.5),
  createdAt: timestamp('created_at').defaultNow(),
});

// Mistake records
export const mistakes = pgTable('mistakes', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => profiles.id).notNull(),
  conceptId: uuid('concept_id').references(() => concepts.id),
  category: mistakeCategoryEnum('category').notNull(),
  subject: text('subject').notNull(),
  chapter: text('chapter').notNull(),
  topic: text('topic').default(''),
  questionText: text('question_text'),
  userAnswer: text('user_answer'),
  correctAnswer: text('correct_answer'),
  marksLost: real('marks_lost').default(0),
  totalMarks: real('total_marks').default(0),
  timeSpentSeconds: integer('time_spent_seconds'),
  aiAnalysis: text('ai_analysis'),
  improvementSuggestion: text('improvement_suggestion'),
  isRecurring: boolean('is_recurring').default(false),
  occurrenceCount: integer('occurrence_count').default(1),
  createdAt: timestamp('created_at').defaultNow(),
});

// FSRS revision cards
export const revisionCards = pgTable('revision_cards', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => profiles.id).notNull(),
  conceptId: uuid('concept_id').references(() => concepts.id),
  front: text('front').notNull(),
  back: text('back').notNull(),
  subject: text('subject').notNull(),
  chapter: text('chapter').notNull(),
  due: timestamp('due').defaultNow(),
  stability: real('stability').default(0),
  difficulty: real('difficulty').default(0),
  elapsedDays: integer('elapsed_days').default(0),
  scheduledDays: integer('scheduled_days').default(0),
  reps: integer('reps').default(0),
  lapses: integer('lapses').default(0),
  state: integer('state').default(0), // FSRS State enum
  lastReview: timestamp('last_review'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Review logs for revision cards
export const reviewLogs = pgTable('review_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => profiles.id).notNull(),
  cardId: uuid('card_id').references(() => revisionCards.id).notNull(),
  rating: integer('rating').notNull(), // 1=Again, 2=Hard, 3=Good, 4=Easy
  elapsedDays: integer('elapsed_days'),
  scheduledDays: integer('scheduled_days'),
  review: timestamp('review').defaultNow(),
  state: integer('state'),
  responseTimeMs: integer('response_time_ms'),
});

// Study tasks (planner)
export const studyTasks = pgTable('study_tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => profiles.id).notNull(),
  title: text('title').notNull(),
  description: text('description').default(''),
  type: taskTypeEnum('type').default('study'),
  subject: text('subject'),
  chapter: text('chapter'),
  priority: taskPriorityEnum('priority').default('medium'),
  estimatedMinutes: integer('estimated_minutes').default(45),
  scheduledDate: timestamp('scheduled_date').notNull(),
  scheduledStartTime: text('scheduled_start_time'), // HH:mm
  isCompleted: boolean('is_completed').default(false),
  completedAt: timestamp('completed_at'),
  focusScore: integer('focus_score'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Mock test results
export const mockTests = pgTable('mock_tests', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => profiles.id).notNull(),
  testName: text('test_name').notNull(),
  totalQuestions: integer('total_questions').notNull(),
  attempted: integer('attempted').default(0),
  correct: integer('correct').default(0),
  incorrect: integer('incorrect').default(0),
  unattempted: integer('unattempted').default(0),
  totalMarks: real('total_marks').notNull(),
  marksObtained: real('marks_obtained').default(0),
  negativeMarks: real('negative_marks').default(0),
  timeTaken: integer('time_taken'), // minutes
  totalTime: integer('total_time'),
  subjectWise: jsonb('subject_wise'), // JSON array of per-subject data
  createdAt: timestamp('created_at').defaultNow(),
});

// Performance snapshots (daily aggregated metrics)
export const performanceSnapshots = pgTable('performance_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => profiles.id).notNull(),
  date: timestamp('date').notNull(),
  studyMinutes: integer('study_minutes').default(0),
  conceptsLearned: integer('concepts_learned').default(0),
  conceptsRevised: integer('concepts_revised').default(0),
  questionsAttempted: integer('questions_attempted').default(0),
  questionsCorrect: integer('questions_correct').default(0),
  accuracy: real('accuracy').default(0),
  focusScore: real('focus_score').default(0),
  retentionRate: real('retention_rate').default(0),
  emotionalState: emotionalStateEnum('emotional_state').default('neutral'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Mentor chat history
export const mentorChats = pgTable('mentor_chats', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => profiles.id).notNull(),
  role: text('role').notNull(), // 'user' or 'mentor'
  content: text('content').notNull(),
  metadata: jsonb('metadata'), // emotional state, action items, etc.
  createdAt: timestamp('created_at').defaultNow(),
});

// Tutor sessions
export const tutorSessions = pgTable('tutor_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => profiles.id).notNull(),
  conceptId: uuid('concept_id').references(() => concepts.id),
  messages: jsonb('messages').default([]),
  cognitiveLevel: text('cognitive_level').default('intermediate'),
  understandingGained: integer('understanding_gained').default(0),
  summary: text('summary'),
  startedAt: timestamp('started_at').defaultNow(),
  endedAt: timestamp('ended_at'),
});

// Study sessions (time tracking)
export const studySessions = pgTable('study_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => profiles.id).notNull(),
  subject: text('subject'),
  chapter: text('chapter'),
  startedAt: timestamp('started_at').defaultNow(),
  endedAt: timestamp('ended_at'),
  durationMinutes: integer('duration_minutes'),
  focusScore: integer('focus_score'),
  breaksTaken: integer('breaks_taken').default(0),
  notes: text('notes'),
});

// --- Phase 2: Knowledge Base & Inference ---

export const studentModels = pgTable('student_models', {
  userId: uuid('user_id').primaryKey().references(() => profiles.id, { onDelete: 'cascade' }),
  learningStyle: text('learning_style'),
  strengths: jsonb('strengths').default([]),
  chronicWeaknesses: jsonb('chronic_weaknesses').default([]),
  behavioralTraps: jsonb('behavioral_traps').default([]),
  lastUpdated: timestamp('last_updated').defaultNow(),
});

export const materials = pgTable('materials', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => profiles.id, { onDelete: 'cascade' }).notNull(),
  title: text('title').notNull(),
  sourceType: text('source_type').default('text'),
  rawContent: text('raw_content').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const materialChunks = pgTable('material_chunks', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => profiles.id, { onDelete: 'cascade' }).notNull(),
  materialId: uuid('material_id').references(() => materials.id, { onDelete: 'cascade' }).notNull(),
  chunkText: text('chunk_text').notNull(),
  embedding: vector('embedding', { dimensions: 768 }),
  createdAt: timestamp('created_at').defaultNow(),
});

// --- Phase 3: Mock Test Autopsy Engine ---

export const mockAutopsies = pgTable('mock_autopsies', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => profiles.id, { onDelete: 'cascade' }).notNull(),
  testName: text('test_name').notNull(),
  currentScore: integer('current_score').notNull().default(0),
  potentialScore: integer('potential_score').notNull().default(0),
  recoverableMarks: integer('recoverable_marks').notNull().default(0),
  totalQuestions: integer('total_questions'),
  examType: text('exam_type').default('NEET'),
  mentorInsight: text('mentor_insight'),
  mentorQuote: text('mentor_quote'),
  praiseRoastTag: text('praise_roast_tag'),
  confidenceLevel: text('confidence_level').default('Medium'), // High, Medium, Low
  ocrRawText: text('ocr_raw_text'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const autopsyQuestions = pgTable('autopsy_questions', {
  id: uuid('id').primaryKey().defaultRandom(),
  autopsyId: uuid('autopsy_id').references(() => mockAutopsies.id, { onDelete: 'cascade' }).notNull(),
  questionNumber: integer('question_number').notNull(),
  subject: text('subject').notNull(),
  chapter: text('chapter'),
  subtopic: text('subtopic'),
  difficulty: text('difficulty').default('Medium'), // Easy, Medium, Hard
  status: text('status').notNull(), // Correct, Incorrect, Unattempted
  correctAnswer: text('correct_answer'),
  studentAnswer: text('student_answer'),
  mistakeCategory: text('mistake_category'), 
  marksLost: real('marks_lost').default(0),
  suggestedFix: text('suggested_fix'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const recoveryPlans = pgTable('recovery_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  autopsyId: uuid('autopsy_id').references(() => mockAutopsies.id, { onDelete: 'cascade' }).notNull(),
  title: text('title').notNull(), // e.g., "3-Day Biology Sprint"
  expectedMarksGain: integer('expected_marks_gain').notNull(),
  estimatedMinutes: integer('estimated_minutes').notNull(),
  tasks: jsonb('tasks').notNull(), // Array of specific study actions
  isCompleted: boolean('is_completed').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

// --- Phase 4: PULSE (Mental State Engine) ---

export const pulseSignals = pgTable('pulse_signals', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => profiles.id, { onDelete: 'cascade' }).notNull(),
  signalType: text('signal_type').notNull(), // 'self_report', 'session_pattern', 'performance_trend'
  emotionalState: emotionalStateEnum('emotional_state').notNull(),
  confidence: real('confidence').default(0.5), // 0-1 confidence in the detection
  sessionDurationMinutes: integer('session_duration_minutes'),
  recentAccuracy: real('recent_accuracy'),
  interactionCount: integer('interaction_count'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

// --- Phase 5: Educator & Teams ---

export const institutes = pgTable('institutes', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  ownerId: uuid('owner_id').references(() => profiles.id).notNull(),
  stripeSubscriptionId: text('stripe_subscription_id'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const instituteMemberships = pgTable('institute_memberships', {
  id: uuid('id').primaryKey().defaultRandom(),
  instituteId: uuid('institute_id').references(() => institutes.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => profiles.id, { onDelete: 'cascade' }).notNull(),
  role: text('role').default('student'), // 'educator', 'student'
  joinedAt: timestamp('joined_at').defaultNow(),
});
