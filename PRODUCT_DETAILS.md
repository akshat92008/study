# Cognition OS — Full Technical & Product Specification

**Cognition OS** is a premium, AI-native academic operating system engineered to transform raw educational content consumption into an autonomous, mathematically optimized knowledge acquisition system. 

Unlike traditional platforms that act as static test engines or video libraries, Cognition OS functions as an active cognitive engine. It continuously models a learner's conceptual mastery, memory retrieval decay trajectories, psychometric error root causes, and behavioral fatigue indices to programmatically generate personalized daily learning blueprints.

---

## 1. Complete Feature Deep-Dive & System Modules

### 1.1 Command Center Dashboard
* **Dynamic Global Telemetry:** Acts as the mission-critical operations view displaying unified metrics across every subsystem.
* **Mastery Progress Matrix:** Displays aggregate performance indices across subject categories alongside global targets.
* **Real-time Memory Load:** Real-time visual metrics displaying active concept counts awaiting spaced repetition retrieval loops.
* **Mistake Concentration Radar:** Renders immediate visual callouts highlighting the top historical failure patterns impacting the student's marks.

### 1.2 Cognition Graph Engine
* **Multidimensional Ontology Mapping:** Maps user activities directly to conceptual entity networks structured hierarchically by Subject, Chapter, and Topic levels.
* **Vector Embeddings via `pgvector`:** Connects semantic concepts using Next.js Server Actions and Google Gemini embedding models (768 dimensions), allowing complex multi-node contextual queries.
* **6-Tier Granular Mastery Classification:** Dynamically shifts concept properties across distinct stages based on continuous correctness and review frequency parameters:
  1. *Not Started*
  2. *Exposed*
  3. *Developing*
  4. *Proficient*
  5. *Mastered*
  6. *Automated*

### 1.3 Mistake Intelligence & Analysis Engine
* **Psychological & Technical Error Classification:** Automatically assigns incorrect test inputs to an explicit structured enum taxonomy:
  * `conceptual` — Missing fundamental structural rules.
  * `calculation` — Numerical errors despite valid logic.
  * `silly` — Careless execution faults.
  * `time_pressure` — Rushed responses leading to skipped validation.
  * `misread` — Erroneous processing of text constraints.
  * `incomplete_knowledge` — Partial recall failures.
  * `overconfidence` — Skipping verification steps.
  * `anxiety` — Emotional blanking during testing.
* **Autonomous Remedial Generation:** Employs advanced LLM reasoning prompts to extract immediate actionable micro-improvements specifically tailored to prevent the identified mistake category.

### 1.4 Adaptive Spaced Repetition System (FSRS-5 Integration)
* **Mathematical Stability & Difficulty Modeling:** Integrates the cutting-edge Free Spaced Repetition Scheduler (FSRS-5) system to compute exact multi-variable retention curves.
* **Predictive Decay Telemetry:** Triggers customized revision items dynamically when the target retention probability threshold drops below standard performance indices.
* **Card Health Lifecycles:** Logs detailed session rating telemetry (`Again`, `Hard`, `Good`, `Easy`) to dynamically adjust lapse multipliers and interval steps.

### 1.5 Socratic AI Tutor & Mentor Subsystems
* **Active Socratic Guidance Engine:** Implements prompt structures via **Gemini 2.5 Flash** designed to challenge learners using leading questions rather than delivering passive solutions.
* **Psychometric Context Awareness:** Reads performance histories, current accuracy metrics, and recent error records directly from the database prior to response generation to provide deep situational coaching.
* **Emotion & Fatigue Telemetry:** Automatically parses user input rhythms to gauge active mental states (`focused`, `motivated`, `stressed`, `burnt_out`, `anxious`, `frustrated`), dynamically altering response complexity and recommending strategic breaks.

### 1.6 Intelligent Daily Planner
* **Algorithmic Load Distribution:** Distributes study schedules dynamically by processing target date limits, dynamic syllabus weightage, and current focus levels.
* **Autonomous Task Defragmentation:** Automatically shifts pending daily objectives downstream while strictly capping maximum concurrent assignments to preserve optimal learner focus.

---

## 2. Dynamic Exam Registry Architecture

Cognition OS utilizes a central curriculum hub that dynamically scales interface scoring boundaries, timer logic, and domain structures based on user profile configurations:

```typescript
export const EXAM_REGISTRY = {
  NEET: {
    name: 'NEET (UG)',
    maxMarks: 720,
    subjects: ['Physics', 'Chemistry', 'Botany', 'Zoology'],
    timerMinutes: 200,
    defaultStudyHours: 8,
  },
  JEE: {
    name: 'JEE (Main & Advanced)',
    maxMarks: 300,
    subjects: ['Physics', 'Chemistry', 'Mathematics'],
    timerMinutes: 180,
    defaultStudyHours: 8,
  },
  SAT: {
    name: 'SAT',
    maxMarks: 1600,
    subjects: ['Reading & Writing', 'Mathematics'],
    timerMinutes: 134,
    defaultStudyHours: 4,
  },
  UPSC: {
    name: 'UPSC CSE',
    maxMarks: 2025,
    subjects: ['General Studies', 'CSAT', 'Optional'],
    timerMinutes: 120,
    defaultStudyHours: 10,
  },
  CUSTOM: {
    name: 'Custom Academic Target',
    maxMarks: 100,
    subjects: ['Core Major', 'Elective Track', 'Research Focus'],
    timerMinutes: 60,
    defaultStudyHours: 6,
  },
};
```

---

## 3. Database Schema & Relational Blueprint

Built securely on PostgreSQL via Supabase, with native Row-Level Security (RLS) constraints mapped to every user table to enforce strict multi-tenant isolation.

### 3.1 Primary Data Models
* `profiles`: Tracks core user metadata, target academic criteria, active session parameters, and user state telemetry.
* `concepts`: The atomic record representing an individual learner knowledge node, embedding vectors, confidence status, and decay variables.
* `concept_links`: Models directional graph weights linking prerequisite topics directly to target entities.
* `mistakes`: Stores deep JSON metadata recording explicit historical testing missteps, AI diagnostic breakdowns, and recurrent issue flags.
* `revision_cards`: Manages explicit spaced-repetition card properties, FSRS internal states, stability matrices, and scheduling intervals.
* `review_logs`: Retains full transaction history of card evaluation sessions.
* `study_tasks`: Tracks generated real-time daily objectives, focus session durations, and schedule completions.
* `mock_tests`: Aggregates complete simulated test attempts, negative score multipliers, and dynamic subject performance arrays.
* `performance_snapshots`: Generates temporal analytics snapshots documenting long-term accuracy, efficiency, and behavioral progression.
* `mentor_chats` & `tutor_sessions`: Retains stateful conversational histories and cognitive dialogue progress arrays.

---

## 4. UI/UX & Bespoke Design System

Cognition OS is engineered with an ultra-premium visual aesthetic designed to establish deep focus and high user delight.

* **Color Foundations:** Built on pure HSL curated color tokens using deep dark-mode bases (`--bg-root`, `--bg-surface`, `--bg-elevated`) paired with highly luminous UI neon indicators (`--accent-purple`, `--accent-cyan`, `--success`, `--danger`).
* **Typography & Glassmorphism:** Utilizes highly legible web typography (*Inter* and *JetBrains Mono*) combined with multi-layer CSS background blur filters and sleek semi-transparent UI container borders.
* **Non-blocking Telemetry Rendering:** Data panels scale cleanly on window resizing, leveraging dynamic CSS grid flows without framework layout shifts or hydration display bugs.

---

## 5. Security & Deployment Matrix

* **Authentication Boundary:** End-to-end token validation handled automatically via Next.js middleware injecting explicit `x-next-pathname` routing instructions to protect Server Component layouts.
* **RLS Enforcement:** Custom SQL security scripts guarantee that users can never query, inject, or update records not directly tied to `auth.uid()`.
* **Idempotent Operations:** Setup scripts contain safe cascade cleanups allowing zero-downtime execution and rapid configuration updates directly via production environments.
* **Deployment Workflow:** Verified for seamless edge deployments on Vercel leveraging automatic Server Component streaming optimizations.
