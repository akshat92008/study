# MODULE 3: Database Schema & Migrations

## PROMPT FOR AI BUILDER

```
You are building the complete database schema for Cognition OS using Drizzle ORM with Supabase PostgreSQL.
Create the schema file and the raw SQL migration. Enable pgvector extension.
Every table MUST have RLS policies. Follow the schema EXACTLY.
```

---

## STEP 1: Enable pgvector in Supabase

Go to your Supabase Dashboard → SQL Editor → Run:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

---

## STEP 2: Drizzle Schema — `lib/db/schema.ts`

```typescript
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
  examType: text('exam_type').default('NEET'),
  targetYear: integer('target_year'),
  targetScore: integer('target_score'),
  currentScore: integer('current_score'),
  studyHoursPerDay: integer('study_hours_per_day').default(8),
  emotionalState: emotionalStateEnum('emotional_state').default('neutral'),
  onboardingComplete: boolean('onboarding_complete').default(false),
  streakDays: integer('streak_days').default(0),
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
```

---

## STEP 3: SQL Migration — `lib/db/migrations/001_init.sql`

Run this in Supabase SQL Editor:

```sql
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS vector;

-- Create enums
CREATE TYPE mastery_level AS ENUM ('not_started','exposed','developing','proficient','mastered','automated');
CREATE TYPE confidence_level AS ENUM ('very_low','low','medium','high','very_high');
CREATE TYPE mistake_category AS ENUM ('conceptual','calculation','silly','time_pressure','misread','incomplete_knowledge','overconfidence','anxiety','recall_failure');
CREATE TYPE emotional_state AS ENUM ('focused','motivated','stressed','burnt_out','anxious','frustrated','confident','overwhelmed','bored','neutral');
CREATE TYPE task_type AS ENUM ('study','revision','practice','mock_test','break','review');
CREATE TYPE task_priority AS ENUM ('critical','high','medium','low');

-- Profiles
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  exam_type TEXT DEFAULT 'NEET',
  target_year INT,
  target_score INT,
  current_score INT,
  study_hours_per_day INT DEFAULT 8,
  emotional_state emotional_state DEFAULT 'neutral',
  onboarding_complete BOOLEAN DEFAULT false,
  streak_days INT DEFAULT 0,
  last_active_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', 'Student'), NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Concepts
CREATE TABLE concepts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  chapter TEXT NOT NULL,
  topic TEXT DEFAULT '',
  mastery mastery_level DEFAULT 'not_started',
  confidence confidence_level DEFAULT 'low',
  last_reviewed_at TIMESTAMPTZ,
  times_reviewed INT DEFAULT 0,
  times_correct INT DEFAULT 0,
  times_incorrect INT DEFAULT 0,
  forgetting_probability REAL DEFAULT 1.0,
  retention_strength REAL DEFAULT 0.0,
  embedding vector(768),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Concept Links
CREATE TABLE concept_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  source_concept_id UUID NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  target_concept_id UUID NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  link_type TEXT DEFAULT 'prerequisite',
  strength REAL DEFAULT 0.5,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Mistakes
CREATE TABLE mistakes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  concept_id UUID REFERENCES concepts(id),
  category mistake_category NOT NULL,
  subject TEXT NOT NULL,
  chapter TEXT NOT NULL,
  topic TEXT DEFAULT '',
  question_text TEXT,
  user_answer TEXT,
  correct_answer TEXT,
  marks_lost REAL DEFAULT 0,
  total_marks REAL DEFAULT 0,
  time_spent_seconds INT,
  ai_analysis TEXT,
  improvement_suggestion TEXT,
  is_recurring BOOLEAN DEFAULT false,
  occurrence_count INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Revision Cards
CREATE TABLE revision_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  concept_id UUID REFERENCES concepts(id),
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  subject TEXT NOT NULL,
  chapter TEXT NOT NULL,
  due TIMESTAMPTZ DEFAULT now(),
  stability REAL DEFAULT 0,
  difficulty REAL DEFAULT 0,
  elapsed_days INT DEFAULT 0,
  scheduled_days INT DEFAULT 0,
  reps INT DEFAULT 0,
  lapses INT DEFAULT 0,
  state INT DEFAULT 0,
  last_review TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Review Logs
CREATE TABLE review_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES revision_cards(id) ON DELETE CASCADE,
  rating INT NOT NULL,
  elapsed_days INT,
  scheduled_days INT,
  review TIMESTAMPTZ DEFAULT now(),
  state INT
);

-- Study Tasks
CREATE TABLE study_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  type task_type DEFAULT 'study',
  subject TEXT,
  chapter TEXT,
  priority task_priority DEFAULT 'medium',
  estimated_minutes INT DEFAULT 45,
  scheduled_date TIMESTAMPTZ NOT NULL,
  scheduled_start_time TEXT,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  focus_score INT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Mock Tests
CREATE TABLE mock_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  test_name TEXT NOT NULL,
  total_questions INT NOT NULL,
  attempted INT DEFAULT 0,
  correct INT DEFAULT 0,
  incorrect INT DEFAULT 0,
  unattempted INT DEFAULT 0,
  total_marks REAL NOT NULL,
  marks_obtained REAL DEFAULT 0,
  negative_marks REAL DEFAULT 0,
  time_taken INT,
  total_time INT,
  subject_wise JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Performance Snapshots
CREATE TABLE performance_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date TIMESTAMPTZ NOT NULL,
  study_minutes INT DEFAULT 0,
  concepts_learned INT DEFAULT 0,
  concepts_revised INT DEFAULT 0,
  questions_attempted INT DEFAULT 0,
  questions_correct INT DEFAULT 0,
  accuracy REAL DEFAULT 0,
  focus_score REAL DEFAULT 0,
  retention_rate REAL DEFAULT 0,
  emotional_state emotional_state DEFAULT 'neutral',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Mentor Chats
CREATE TABLE mentor_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tutor Sessions
CREATE TABLE tutor_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  concept_id UUID REFERENCES concepts(id),
  messages JSONB DEFAULT '[]',
  cognitive_level TEXT DEFAULT 'intermediate',
  understanding_gained INT DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ
);

-- Study Sessions
CREATE TABLE study_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subject TEXT,
  chapter TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ,
  duration_minutes INT,
  focus_score INT,
  breaks_taken INT DEFAULT 0,
  notes TEXT
);

-- ======= RLS POLICIES =======
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE concept_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE mistakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE revision_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE mock_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentor_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE tutor_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: users can only access their own data
CREATE POLICY "Users access own profile" ON profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "Users access own concepts" ON concepts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own concept_links" ON concept_links FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own mistakes" ON mistakes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own revision_cards" ON revision_cards FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own review_logs" ON review_logs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own study_tasks" ON study_tasks FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own mock_tests" ON mock_tests FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own perf_snapshots" ON performance_snapshots FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own mentor_chats" ON mentor_chats FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own tutor_sessions" ON tutor_sessions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own study_sessions" ON study_sessions FOR ALL USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_concepts_user ON concepts(user_id);
CREATE INDEX idx_concepts_subject ON concepts(user_id, subject);
CREATE INDEX idx_mistakes_user ON mistakes(user_id);
CREATE INDEX idx_revision_due ON revision_cards(user_id, due);
CREATE INDEX idx_tasks_date ON study_tasks(user_id, scheduled_date);
CREATE INDEX idx_perf_date ON performance_snapshots(user_id, date);
CREATE INDEX idx_mentor_user ON mentor_chats(user_id, created_at);
```

---

## VERIFICATION

1. Run the SQL migration in Supabase SQL Editor
2. Verify all 12 tables exist in Table Editor
3. Verify RLS is enabled (lock icon) on all tables
4. Create a test user via signup → verify profile auto-created

**→ NEXT: MODULE 4 (Dashboard Shell)**
