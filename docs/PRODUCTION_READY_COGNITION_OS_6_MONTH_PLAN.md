# Cognition OS Production-Ready Build Plan

Duration: 6 months
Target: production-ready student product, not only a demo
Scope: MIND, COMMAND, AUTOPSY, ATLAS, MEMORY, chat, onboarding, event bus, ingestion, security, reliability, evals, billing, and launch readiness

## 0. Definition Of Done

Cognition OS is production-ready only when a real student can:

1. Sign up, complete onboarding, and upload material without manual intervention.
2. Open chat and continue a persistent conversation across sessions.
3. Send text, image, and document questions, then receive a personalized answer.
4. Complete one daily session card from the chat.
5. Get a personalized closing message after the session.
6. Upload or enter a mock test and get an autopsy.
7. See wrong answers affect ATLAS mastery.
8. See wrong answers create MEMORY cards.
9. Review due MEMORY cards with a correct FSRS scheduler.
10. See COMMAND adapt tomorrow's session based on mistakes, mastery, and due cards.
11. Trust that all user data is RLS-protected.
12. Pay, upgrade, downgrade, and keep access state consistent.
13. Receive reliable product behavior under normal traffic and normal AI failures.

Production-ready means:

- No silent core-loop failures.
- No schema drift between routes and database.
- No fake or placeholder AI paths in the user-facing loop.
- No module that only looks wired from the UI.
- All critical flows covered by automated tests and AI evals.
- Observability exists for every critical module.

## 1. Product Architecture Target

The production architecture should be:

```text
Client
  Chat, Dashboard, Onboarding, Revision, Autopsy

API Layer
  Authenticated Next.js routes
  Shared request validation
  Idempotency keys
  Rate limits

Application Services
  ChatService
  OnboardingService
  IngestionService
  EventService
  LearnerStateService
  SessionService
  AutopsyService
  AtlasService
  MemoryService
  CommandService

AI Layer
  ProviderRegistry
  PromptRegistry
  Orchestrator
  Worker agents
  Structured output validators

Data Layer
  Supabase Postgres
  pgvector
  Storage
  RLS policies
  migrations

Async Layer
  Event outbox
  event_consumer_tracking
  retry and dead-letter queue
  cron workers

Observability
  structured logs
  metrics
  traces
  AI evals
  alerts
```

The rule:

Every state change in a module must publish a typed event. Every event must be idempotent. Every consumer must be retryable.

## 2. Current Repo Priorities

Based on direct code review, the first month must not add features. It must repair contracts.

Highest-priority fixes:

1. Replace all old column names with schema-backed names.
2. Make `/api/events` call the same dispatcher path as server-side module events.
3. Remove or fully disable PULSE remnants if PULSE is out of scope.
4. Replace `genai = null` with a real provider adapter or remove direct import paths.
5. Fix onboarding redirect loop risk.
6. Persist image and document chat messages.
7. Make `match_chat_memory` verification match the real RPC signature.
8. Add tests around the full event path, not just isolated engines.

## 3. Six-Month Roadmap

### Month 1: Stabilize The Product Spine

Goal: the app stops lying to itself. Routes, database, event names, and AI providers agree.

#### Week 1: Contract Freeze

Tasks:

- Generate a database contract map from `lib/db/schema.ts`.
- Audit every `.select()`, `.insert()`, `.update()`, and RPC call.
- Delete or migrate every old field:
  - `next_review` to `due`
  - old `study_sessions` fields to current schema
  - `last_study_date` and `last_session_date` to one chosen profile/session source
  - old PULSE columns to deleted code or real schema
- Add a route-level schema validation helper.
- Add a CI command that fails if TypeScript takes too long or hangs.

Code to add:

```ts
// lib/db/contracts.ts
import { z } from 'zod';

export const uuidSchema = z.string().uuid();

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export function assertUserId(value: unknown): string {
  return uuidSchema.parse(value);
}
```

Verification tests:

- `pnpm run type-check` completes in under 90 seconds.
- Every API route touching Supabase has a test for missing auth.
- Add a schema drift test that searches forbidden fields:

```ts
// tests/contracts/noSchemaDrift.test.ts
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const forbidden = [
  'next_review',
  'last_study_date',
  'last_session_date',
  'friction_score',
  'signal_data',
  'detected_at',
];

function walk(dir: string, files: string[] = []) {
  for (const item of fs.readdirSync(dir)) {
    const full = path.join(dir, item);
    if (full.includes('node_modules') || full.includes('.next')) continue;
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, files);
    else if (/\.(ts|tsx)$/.test(full)) files.push(full);
  }
  return files;
}

describe('schema drift', () => {
  it('does not use removed database fields', () => {
    const offenders: string[] = [];
    for (const file of walk(root)) {
      const text = fs.readFileSync(file, 'utf8');
      for (const token of forbidden) {
        if (text.includes(token)) offenders.push(`${file}: ${token}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
```

#### Week 2: Auth, Onboarding, Gemini, Uploads

Tasks:

- Fix dashboard/onboarding redirect logic using route groups or middleware request headers.
- Replace direct `genai` usage with `ProviderRegistry`.
- Make onboarding upload support PDF, text, and images.
- Store uploads in Supabase Storage.
- Create initial concepts, learner profile, and Day 1 session inside a transaction.

Code pattern:

```ts
// lib/ai/client.ts
import { ProviderRegistry } from './providers/ProviderRegistry';

export async function generateStructured<T>(input: {
  model?: string;
  system: string;
  prompt: string;
  schemaName: string;
  schema: unknown;
}): Promise<T> {
  const provider = ProviderRegistry.getDefault();
  const response = await provider.generate({
    model: input.model,
    system: input.system,
    prompt: input.prompt,
    responseSchema: input.schema,
  });

  return response.parsed as T;
}
```

Onboarding weak-spot prompt:

```text
You are Cognition OS onboarding intelligence.

Goal:
Create the student's first useful learning state in under 60 seconds.

Inputs:
- Exam or learning goal
- Deadline
- Uploaded material summary
- Diagnostic answers

Return JSON only:
{
  "studentSummary": "one paragraph",
  "detectedLevel": "beginner|intermediate|advanced",
  "prioritySubjects": [
    {
      "subject": "string",
      "why": "string",
      "confidence": 0.0
    }
  ],
  "initialConcepts": [
    {
      "name": "string",
      "subject": "string",
      "chapter": "string",
      "mastery": "not_started|exposed|developing|proficient|mastered|automated",
      "reason": "string"
    }
  ],
  "dayOneSession": {
    "title": "string",
    "focusTopic": "string",
    "estimatedMinutes": 25,
    "reason": "string"
  }
}

Rules:
- Do not overstate certainty.
- Prefer useful first action over broad syllabus coverage.
- Mention no module names to the student.
```

Verification tests:

- New user can complete onboarding in Playwright.
- Upload route works with one PDF, one image, one text file.
- Onboarding creates:
  - profile completed flag
  - at least 5 concepts
  - Day 1 session card
  - first assistant welcome message

#### Week 3: Single Event Bus

Tasks:

- Make all event creation go through `EventDispatcher.publish`.
- Deprecate raw insert-only `/api/events`.
- Add typed event names and payload validators.
- Add idempotency key to every event.
- Add dead-letter queue table.
- Add a worker command for local processing.

Code to add:

```ts
// app/api/events/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { EventDispatcher } from '@/lib/events/orchestrator';
import { StudentEventInputSchema } from '@/lib/events/schema';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = StudentEventInputSchema.parse(await req.json());

  const result = await EventDispatcher.publish({
    userId: user.id,
    type: body.type,
    source: body.source ?? 'client',
    data: body.data,
    idempotencyKey: body.idempotencyKey,
  });

  return NextResponse.json({ ok: true, eventId: result.eventId });
}
```

Event naming standard:

```ts
export const EventTypes = {
  MIND_MESSAGE_CREATED: 'MIND_MESSAGE_CREATED',
  MIND_TUTOR_COMPLETED: 'MIND_TUTOR_COMPLETED',
  AUTOPSY_MOCK_PROCESSED: 'AUTOPSY_MOCK_PROCESSED',
  ATLAS_MASTERY_UPDATED: 'ATLAS_MASTERY_UPDATED',
  MEMORY_CARD_CREATED: 'MEMORY_CARD_CREATED',
  MEMORY_CARD_REVIEWED: 'MEMORY_CARD_REVIEWED',
  COMMAND_SESSION_CREATED: 'COMMAND_SESSION_CREATED',
  COMMAND_SESSION_COMPLETED: 'COMMAND_SESSION_COMPLETED',
  INGESTION_DOCUMENT_PROCESSED: 'INGESTION_DOCUMENT_PROCESSED',
} as const;
```

Verification tests:

- Posting `MEMORY_CARD_REVIEWED` through client route creates consumer tracking rows.
- Processing events updates learner state.
- Replaying the same event twice does not duplicate cards or mastery updates.
- Failed consumers retry and then enter dead-letter state.

#### Week 4: Chat Persistence And Context

Tasks:

- Persist every chat branch: text, image, document, tutor, artifact.
- Normalize conversation message storage.
- Fix memory RPC verification signature.
- Add context budgeter.
- Add assistant response metadata:
  - intent
  - retrieved concept ids
  - retrieved memory ids
  - artifact ids
  - events emitted

MIND context builder:

```ts
// lib/chat/buildMindContext.ts
export type MindContext = {
  learner: {
    exam?: string;
    deadline?: string;
    level?: string;
    preferredStyle?: string;
  };
  recentMessages: Array<{ role: 'user' | 'assistant'; content: string }>;
  dueCards: Array<{ id: string; front: string; conceptId?: string }>;
  weakConcepts: Array<{ id: string; name: string; mastery: string; reason: string }>;
  recentMistakes: Array<{ conceptName: string; category: string; lesson: string }>;
  retrievedMemories: Array<{ text: string; score: number }>;
};

export function renderMindContext(ctx: MindContext): string {
  return [
    `Learner: ${JSON.stringify(ctx.learner)}`,
    `Weak concepts: ${JSON.stringify(ctx.weakConcepts)}`,
    `Due cards: ${JSON.stringify(ctx.dueCards)}`,
    `Recent mistakes: ${JSON.stringify(ctx.recentMistakes)}`,
    `Relevant memories: ${JSON.stringify(ctx.retrievedMemories)}`,
  ].join('\n\n');
}
```

Verification tests:

- Image answer is visible after page reload.
- A previous mistake appears in the next relevant MIND prompt.
- Missing vector RPC fails loudly in health checks, not silently in production.

### Month 2: Build The Real OS Loop

Goal: one student action triggers every relevant engine.

#### Week 5: AUTOPSY Production Flow

Tasks:

- Accept manual entry, PDF, image, and CSV mock test input.
- Normalize each question into a common row.
- Classify every wrong answer by root cause.
- Write to:
  - `mock_autopsies`
  - `autopsy_questions`
  - `mistakes`
  - `student_events`
- Publish `AUTOPSY_MOCK_PROCESSED`.

Autopsy prompt:

```text
You are Cognition OS Autopsy Engine.

Task:
Analyze a student's mock test attempt. Find the score that is recoverable soon and the score that requires concept rebuilding.

Inputs:
- Exam type
- Subject and chapter when known
- Question text
- Correct answer
- Student answer
- Time spent when available
- Student's known weak concepts
- Recent mistake history

For each wrong answer, classify exactly one primary root cause:
- conceptual
- calculation
- silly
- time_pressure
- anxiety_blank
- misread_question
- guessed
- unknown

Return JSON only:
{
  "overallDiagnosis": "string",
  "recoverableMarks": 0,
  "conceptRebuildMarks": 0,
  "questions": [
    {
      "questionNumber": 1,
      "isCorrect": false,
      "rootCause": "conceptual",
      "conceptName": "string",
      "confidence": 0.0,
      "studentFacingLesson": "string",
      "atlasImpact": {
        "conceptName": "string",
        "masteryDelta": -0.15,
        "reason": "string"
      },
      "memoryCardSeed": {
        "shouldCreate": true,
        "front": "string",
        "back": "string"
      }
    }
  ],
  "nextSevenDays": [
    {
      "focus": "string",
      "why": "string"
    }
  ]
}

Rules:
- Do not blame the student.
- Separate careless marks from knowledge gaps.
- Prefer exam-useful language over generic coaching.
- If confidence is low, say so in JSON.
```

Verification tests:

- Upload a 10-question mock with 4 wrong answers.
- Verify 4 `mistakes` rows.
- Verify at least 2 cards created for conceptual or repeated mistakes.
- Verify ATLAS mastery decreased for affected concepts.
- Verify COMMAND next session includes the highest-impact topic.

#### Week 6: ATLAS Mastery And Prerequisites

Tasks:

- Fix concept link field names.
- Add prerequisite traversal tests.
- Create canonical concept resolution.
- Add mastery update service.
- Add confidence and evidence trail to mastery changes.

Mastery update code:

```ts
// lib/services/masteryService.ts
export type MasteryEvidence =
  | { type: 'correct_answer'; strength: number; sourceId: string }
  | { type: 'wrong_answer'; strength: number; sourceId: string }
  | { type: 'session_completed'; strength: number; sourceId: string }
  | { type: 'card_review'; rating: 'again' | 'hard' | 'good' | 'easy'; sourceId: string };

export async function applyMasteryEvidence(input: {
  userId: string;
  conceptId: string;
  evidence: MasteryEvidence;
}) {
  // 1. Load current mastery.
  // 2. Convert evidence to bounded delta.
  // 3. Apply prerequisite penalty or boost if relevant.
  // 4. Save mastery snapshot.
  // 5. Publish ATLAS_MASTERY_UPDATED.
}
```

Atlas concept expansion prompt:

```text
You are Cognition OS ATLAS Builder.

Goal:
Expand a syllabus chapter into exam-useful micro-concepts.

Inputs:
- Exam name
- Subject
- Chapter
- Uploaded material summary
- Existing concept names

Return JSON only:
{
  "chapter": "string",
  "concepts": [
    {
      "name": "string",
      "description": "string",
      "examImportance": "low|medium|high|very_high",
      "estimatedStudyMinutes": 20,
      "prerequisites": ["string"],
      "commonMistakes": ["string"],
      "exampleQuestionTypes": ["string"]
    }
  ]
}

Rules:
- Do not create duplicate concepts.
- Prefer micro-concepts that can be tested or reviewed.
- For NEET/JEE, include common trap patterns.
```

Verification tests:

- Concept expansion works for Physics, Chemistry, Biology, and Math.
- No fallback single-node graph for known syllabi.
- A weak prerequisite appears in MIND context for an advanced question.

#### Week 7: MEMORY With Correct FSRS

Tasks:

- Use `ts-fsrs` scheduler directly.
- Store FSRS card state exactly.
- Create cards from:
  - MIND gaps
  - AUTOPSY mistakes
  - uploaded material
  - session closing gaps
- Add duplicate detection.

Flashcard generation prompt:

```text
You are Cognition OS Memory Engine.

Goal:
Create high-retention flashcards from a learning gap.

Inputs:
- Concept
- Student mistake or weak answer
- Exam type
- Source text

Return JSON only:
{
  "cards": [
    {
      "type": "conceptual|application|trap|formula|definition",
      "front": "string",
      "back": "string",
      "explanation": "string",
      "conceptName": "string",
      "examTag": "string",
      "difficulty": 1
    }
  ]
}

Rules:
- One atomic idea per card.
- No vague cards.
- Prefer retrieval questions over recognition questions.
- For calculation-heavy topics, include one trap card.
- Maximum 5 cards unless the source is dense.
```

FSRS code pattern:

```ts
// lib/services/fsrsService.ts
import { createEmptyCard, fsrs, generatorParameters, Rating } from 'ts-fsrs';

const f = fsrs(generatorParameters({ request_retention: 0.9 }));

export function reviewCard(cardState: unknown, rating: Rating, reviewedAt = new Date()) {
  const card = cardState ?? createEmptyCard(reviewedAt);
  const scheduling = f.repeat(card, reviewedAt);
  return scheduling[rating].card;
}
```

Verification tests:

- Easy rating schedules later than Good.
- Again schedules soon.
- Duplicate card seeds do not create duplicate active cards.
- Due-card count in chat matches revision dashboard.

#### Week 8: COMMAND Daily Mission

Tasks:

- Generate exactly one primary daily card.
- Use due cards, weak concepts, recent mistakes, exam countdown, and recent sessions.
- Cache daily card but allow replan after mock test.
- Add session start, progress, completion, and closing events.

Command prompt:

```text
You are Cognition OS Command Engine.

Goal:
Choose the single highest-leverage study session for today.

Inputs:
- Exam and deadline
- Available minutes
- Weak concepts
- Due memory cards
- Recent mock mistakes
- Recent completed sessions
- Current mastery map summary

Return JSON only:
{
  "title": "string",
  "focusTopic": "string",
  "estimatedMinutes": 25,
  "reason": "string",
  "sessionPlan": [
    {
      "step": "teach|retrieve|practice|review|close",
      "minutes": 5,
      "instruction": "string"
    }
  ],
  "successCriteria": ["string"],
  "shouldMentionToStudent": "string"
}

Rules:
- Choose one focus, not a task list.
- Prefer recoverable marks near the exam.
- Prefer prerequisite repair when advanced topics keep failing.
- Do not mention internal module names.
```

Verification tests:

- Same-day repeated visits return same card.
- Completing session increments streak once.
- Mock test after daily card can trigger a replan.
- Closing message references real evidence.

### Month 3: Make Chat Feel Like The Product

Goal: the student feels known, not merely answered.

#### Week 9: Orchestrator And Intent Routing

Tasks:

- Route to worker engines only when needed.
- Add structured tool outputs.
- Add fallback if worker fails.
- Log every route decision.

Orchestrator prompt:

```text
You are Cognition OS Orchestrator.

Decide how to handle the student's message.

Return JSON only:
{
  "intent": "direct_answer|solve_question|study_session|make_artifact|mock_autopsy|memory_review|progress_check|planning|emotional_support|unknown",
  "mode": "doubt|learning|workflow",
  "requiredWorkers": ["mind"],
  "shouldAnswerFirst": true,
  "needsFileProcessing": false,
  "riskLevel": "low|medium|high",
  "reason": "string"
}

Rules:
- The student should never see worker names.
- If the student asks a normal question, answer first.
- If the student uploaded a mock test, route to autopsy.
- If the student asks for a plan, route to command.
- If uncertain, choose direct_answer with retrieval context.
```

Verification tests:

- Normal doubt does not trigger autopsy.
- Mock upload triggers autopsy.
- "make revision sheet" returns an artifact.
- "test me" enters learning mode.

#### Week 10: MIND Prompt And Session FSM

Tasks:

- Split MIND into:
  - direct answer
  - Socratic learning
  - session tutor
  - artifact writer
- Add finite-state tutor sessions.
- Add minimum retrieval exchanges only in learning/session mode.

MIND direct-answer prompt:

```text
You are Cognition OS MIND, a brilliant senior tutor who knows this student.

Behavior:
- Answer directly first.
- Be concise unless the student asks for depth.
- Use the student's exam, weak areas, and past mistakes when relevant.
- End with one sharp check question only if it improves learning.
- Do not cross-question before answering.
- Do not mention internal systems.

Student context:
{{context}}

Student message:
{{message}}

Answer:
```

MIND learning-mode prompt:

```text
You are Cognition OS MIND in learning mode.

Goal:
Build durable understanding through retrieval, not passive explanation.

Behavior:
- Start with a short setup.
- Ask one question at a time.
- Adapt based on the student's answer.
- Diagnose the exact fracture point.
- Use analogies only when they help this student's style.
- Reference past mistakes when useful.
- Do not mark a concept covered until the student retrieves and applies it.
- End with an exam-style question.

Student context:
{{context}}

Current session state:
{{state}}

Student message:
{{message}}

Return:
- tutorReply
- detectedGap
- masteryEvidence
- cardSeeds
- nextState
```

Verification tests:

- Direct doubt answers immediately.
- Learning mode asks one question at a time.
- Session completion emits mastery evidence and card seeds.

#### Week 11: Artifacts Inside Chat

Tasks:

- Standardize artifact JSON.
- Render study guides, revision sheets, tests, flashcards, plans, and concept maps.
- Persist artifacts separately from messages.
- Add export to PDF/Markdown.

Artifact writer prompt:

```text
You are Cognition OS Artifact Writer.

Create the requested study artifact for this exact student.

Inputs:
- Student request
- Exam
- Weak concepts
- Uploaded material excerpts
- Recent mistakes

Return JSON only:
{
  "artifactType": "study_guide|revision_sheet|practice_test|flashcards|concept_map|study_plan",
  "title": "string",
  "sections": [
    {
      "heading": "string",
      "content": "string",
      "items": ["string"]
    }
  ],
  "practiceQuestions": [
    {
      "question": "string",
      "answer": "string",
      "explanation": "string",
      "conceptName": "string"
    }
  ]
}

Rules:
- Use the student's uploaded material when available.
- Make exam-specific, not generic.
- Include mistake traps when known.
```

Verification tests:

- Artifacts survive reload.
- Artifact export contains the same content.
- Practice test answers can be submitted and scored.

#### Week 12: Image And Document Intelligence

Tasks:

- Add OCR provider fallback.
- Extract diagrams when possible.
- Chunk PDFs into searchable material.
- Add citation/source snippets for document answers.

Verification tests:

- Photo of a printed question produces answer and persisted history.
- PDF upload creates chunks and embeddings.
- Asking a document-specific question retrieves correct chunks.

### Month 4: Production Hardening

Goal: the product survives real usage and AI failures.

#### Week 13: RLS And Security Audit

Tasks:

- Verify every table has RLS enabled.
- Add policy tests for cross-user denial.
- Add storage bucket policies.
- Remove service-role usage from user routes.
- Validate webhooks with signatures.

Verification tests:

- User A cannot read User B chat messages, cards, mistakes, concepts, uploads, autopsies, or events.
- Anonymous user cannot call private routes.
- Stripe webhook rejects invalid signature.

#### Week 14: Observability

Tasks:

- Add structured logs to every module.
- Add AI latency, token usage, and error metrics.
- Add event lag metrics.
- Add dead-letter alerts.

Code pattern:

```ts
// lib/observability/log.ts
export function logEvent(name: string, fields: Record<string, unknown>) {
  console.log(JSON.stringify({
    name,
    level: 'info',
    ts: new Date().toISOString(),
    ...fields,
  }));
}
```

Verification tests:

- Every critical API route emits request id.
- Event worker metrics include processed, failed, retrying, and dead-letter counts.
- AI provider failures include provider, model, route, and retry count.

#### Week 15: Reliability And Fallbacks

Tasks:

- Add provider fallback.
- Add retry policy with exponential backoff.
- Add idempotency for upload, event, autopsy, card generation, and checkout.
- Add circuit breakers for AI providers.

Verification tests:

- Gemini timeout returns useful fallback.
- Duplicate upload does not duplicate concepts.
- Duplicate checkout does not create conflicting subscriptions.

#### Week 16: Performance

Tasks:

- Add indexes for due cards, events, messages, embeddings, concepts.
- Add pagination to chat history and dashboard tables.
- Add vector query limits.
- Add streaming response budgets.

Verification tests:

- Chat first token under 2.5s p95 for text.
- Session card route under 500ms p95 when cached.
- Revision due-card query under 300ms p95 for 10k cards.

### Month 5: Monetization, Evals, And Beta

Goal: charge safely and prove learning quality.

#### Week 17: Billing

Tasks:

- Complete Stripe checkout, portal, webhook, and entitlement sync.
- Add plan limits:
  - free daily messages
  - document limit
  - autopsy limit
  - card limit if needed
- Add graceful upgrade prompts.

Verification tests:

- Free user hits limit and can upgrade.
- Paid user gets unlimited configured access.
- Webhook updates access after payment, cancellation, and failed renewal.

#### Week 18: AI Evals

Tasks:

- Build eval dataset:
  - 100 NEET doubts
  - 50 image questions
  - 50 mock autopsy cases
  - 50 artifact requests
  - 50 memory card seeds
- Score:
  - correctness
  - personalization
  - exam relevance
  - retrieval-practice quality
  - hallucination risk

Eval schema:

```ts
export type EvalCase = {
  id: string;
  category: 'mind' | 'autopsy' | 'command' | 'memory' | 'atlas' | 'artifact';
  input: Record<string, unknown>;
  expected: Record<string, unknown>;
  rubric: Array<{
    name: string;
    maxScore: number;
    description: string;
  }>;
};
```

Verification tests:

- MIND correctness average above 85%.
- Autopsy root-cause classification above 80% on labeled set.
- Flashcard atomicity above 90%.
- Artifact structure valid above 98%.

#### Week 19: Beta Cohort

Tasks:

- Recruit 25-50 serious students.
- Instrument daily session completion.
- Collect confusion reports.
- Add feedback button to every assistant message.
- Add admin-only debugging view.

Verification targets:

- Day 1 activation above 60%.
- Day 7 retention above 25%.
- Daily session completion among active users above 40%.
- Less than 5% critical flow failure rate.

#### Week 20: UX Polish

Tasks:

- Make chat the first surface.
- Keep dashboard as proof, not navigation burden.
- Improve mobile chat, session card, uploads, and revision review.
- Add empty states based on real next action.

Verification tests:

- Mobile viewport has no overlapping text.
- New user can reach first useful answer in under 60 seconds.
- Returning user sees today's card immediately.

### Month 6: Launch Readiness

Goal: public production launch with confidence.

#### Week 21: Data Migration And Backfill

Tasks:

- Write migration audit.
- Backfill missing embeddings.
- Backfill learner state snapshots.
- Backfill event consumer rows for unprocessed historical events when safe.

Verification tests:

- Fresh database migration succeeds.
- Existing database migration succeeds.
- Backfill can be resumed safely.

#### Week 22: Load And Abuse Testing

Tasks:

- Simulate signups, chat, uploads, revision, autopsy.
- Add rate limits per route and per plan.
- Add upload size and MIME restrictions.
- Add AI cost guardrails.

Verification targets:

- 500 concurrent chat users without app crash.
- Upload route rejects unsupported files.
- Cost per active student stays within target margin.

#### Week 23: Launch QA

Tasks:

- Run full product QA script.
- Freeze non-critical feature work.
- Fix only launch blockers.
- Prepare rollback plan.

Full QA script:

1. Create free account.
2. Complete onboarding.
3. Upload PDF.
4. Ask text doubt.
5. Ask image question.
6. Generate revision sheet.
7. Complete daily session.
8. Review due cards.
9. Upload mock test.
10. Confirm ATLAS changed.
11. Confirm MEMORY cards were created.
12. Confirm COMMAND changed tomorrow's card.
13. Upgrade to Pro.
14. Cancel Pro.
15. Confirm entitlements changed.

#### Week 24: Launch

Tasks:

- Enable production monitoring.
- Launch waitlist or controlled public access.
- Review metrics daily.
- Patch only critical failures for first 7 days.

Launch gates:

- No known P0 bugs.
- RLS audit passed.
- Payment audit passed.
- Event bus lag below 5 minutes p95.
- AI eval pass rate above launch threshold.
- Full QA script passes twice on clean accounts.

## 4. Module Specifications

### MIND

Purpose:
Personal AI tutor and chat surface.

Must do:

- Answer directly first.
- Use learner context.
- Support text, image, and document-grounded questions.
- Enter retrieval mode only when the student asks or session requires it.
- Write mastery evidence and card seeds after learning.
- Create artifacts inline.

Production API:

```ts
type MindRequest = {
  userId: string;
  message: string;
  attachments?: Array<{ id: string; type: 'image' | 'pdf' | 'text' }>;
  modeHint?: 'doubt' | 'learning' | 'session';
};

type MindResponse = {
  messageId: string;
  text: string;
  artifacts: Array<{ id: string; type: string }>;
  events: Array<{ type: string; id: string }>;
  metadata: {
    intent: string;
    conceptIds: string[];
    memoryIds: string[];
    model: string;
  };
};
```

Done when:

- 95% of normal student questions receive useful answer without extra diagnostic question.
- Every response is persisted.
- Every session-mode concept produces mastery evidence.

### COMMAND

Purpose:
Daily mission engine.

Must do:

- Generate one session card per day.
- Explain why the card exists.
- Replan after major new evidence.
- Close every session with a personalized message.

Closing message prompt:

```text
You are Cognition OS session closer.

Write one warm, specific closing message after a study session.

Inputs:
- Session topic
- What the student got right
- What the student struggled with
- Past related mistake
- Mastery change
- Cards created
- Tomorrow's likely focus

Rules:
- Be specific.
- Mention real evidence only.
- Do not overpraise.
- End with what happens next.
- Do not mention internal module names.
```

Done when:

- Student always sees today's session on chat open.
- Completion changes streak and learner state.
- Closing message references real session data.

### AUTOPSY

Purpose:
Mock test intelligence.

Must do:

- Ingest tests.
- Classify mistakes.
- Identify recoverable marks.
- Create ATLAS and MEMORY updates.
- Feed COMMAND.

Done when:

- Mock upload changes tomorrow's session.
- Wrong answers appear in MIND context.
- Generated cards are reviewable.

### ATLAS

Purpose:
Knowledge graph and mastery state.

Must do:

- Represent concepts and prerequisites.
- Track mastery by evidence.
- Expand syllabus for any subject.
- Show progress visually.

Done when:

- Every major concept has evidence trail.
- Prerequisite gaps surface in tutoring.
- No hardcoded single-subject fallback in production.

### MEMORY

Purpose:
Spaced repetition.

Must do:

- Use correct FSRS.
- Create cards automatically.
- Deduplicate cards.
- Review cards quickly.
- Feed mastery and command.

Done when:

- Review schedule matches FSRS library behavior.
- Cards come from mistakes and sessions automatically.
- Review completion affects learner state.

### Ingestion

Purpose:
Convert uploaded material into searchable learning context.

Must do:

- Store original file.
- Extract text.
- Chunk semantically.
- Embed chunks.
- Link chunks to concepts.

Document ingestion prompt:

```text
You are Cognition OS material parser.

Goal:
Turn uploaded study material into useful learning units.

Return JSON only:
{
  "title": "string",
  "subject": "string",
  "chapters": [
    {
      "name": "string",
      "concepts": ["string"],
      "summary": "string",
      "importantForExam": ["string"]
    }
  ],
  "studentAction": "string"
}

Rules:
- Preserve source grounding.
- Do not invent chapters if the material does not support them.
- Prefer exam-useful concept names.
```

Done when:

- Uploaded material improves later answers.
- Chat can cite retrieved material snippets.

## 5. Test Matrix

### Unit Tests

Required:

- event schema validation
- event idempotency
- FSRS scheduling
- mastery delta calculation
- concept prerequisite traversal
- prompt context budgeter
- artifact parser
- entitlement resolver

### Integration Tests

Required flows:

- onboarding to first session
- chat message to persisted memory
- image question to persisted answer
- autopsy to mistake to card to session card
- card review to mastery update
- session completion to streak and closing message
- billing webhook to entitlement

### E2E Tests

Required browser scripts:

- new user activation
- returning user daily card
- revision review
- mock autopsy
- upgrade flow
- mobile chat

### AI Evals

Required:

- MIND answer quality
- MIND personalization
- AUTOPSY classification
- ATLAS concept expansion quality
- MEMORY flashcard quality
- COMMAND session choice quality

### Security Tests

Required:

- RLS cross-user denial
- storage object denial
- unauthenticated route denial
- webhook signature validation
- rate limit enforcement

## 6. Engineering Rules For The 6 Months

1. Do not add a feature without an event and verification test.
2. Do not let UI create the illusion of a wired module.
3. Do not use raw untyped event names.
4. Do not let AI structured output enter the database without validation.
5. Do not silently catch core-loop failures.
6. Do not use service-role clients in user-facing routes.
7. Do not build PULSE unless it is intentionally brought back with consent, schema, and tests.
8. Do not count a module complete until it affects another module.
9. Do not launch without RLS and event replay tests.
10. Do not optimize dashboard beauty before the chat loop works.

## 7. Weekly Ship Review Template

Every week, answer:

```text
Week:
Goal:

Shipped:
- 

Critical flows now working:
- 

Evidence:
- tests:
- screenshots:
- logs:
- eval scores:

New risks:
- 

Next week's highest-leverage fix:
- 
```

## 8. Final Launch Checklist

Product:

- Chat persists across sessions.
- Image questions work.
- Document-grounded chat works.
- Daily card works.
- Streak works.
- Closing message works.
- Autopsy works.
- ATLAS updates.
- MEMORY cards created and reviewed.
- COMMAND adapts.
- Billing works.

Technical:

- Typecheck passes.
- Unit tests pass.
- Integration tests pass.
- E2E tests pass.
- AI evals pass.
- RLS audit passes.
- Load test passes.
- Monitoring active.
- Backups configured.
- Rollback documented.

Business:

- Pricing configured.
- Terms and privacy pages ready.
- Support email ready.
- Feedback loop ready.
- Beta cohort learnings incorporated.

## 9. The Real Sequence

The correct order is:

1. Schema and contracts.
2. Event bus.
3. Chat persistence.
4. Onboarding.
5. Autopsy pipeline.
6. Atlas mastery.
7. Memory FSRS.
8. Command session loop.
9. Evals.
10. Security.
11. Billing.
12. Scale.
13. Launch.

If this order is violated, the product will keep feeling impressive in demos but inconsistent in real student use.

