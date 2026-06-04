# Cognition OS — Product Vision

> **Cognition OS is an AI-native learning operating system that turns any learning goal into a living, adaptive system.**

---

## What it does

Cognition OS builds a **personalised learning system** around any goal:

- Maps what the user needs to learn into a structured knowledge graph
- Tracks what they know and what they have forgotten
- Diagnoses mistakes and patterns, not just wrong answers
- Plans each day's work based on evidence, not guesswork
- Surfaces the right material, flashcard, or practice set — exactly when needed

## What it is NOT

- It is not a NEET app. NEET is one preset.
- It is not a flashcard app. Flashcards are a storage mechanism.
- It is not an AI chatbot. Chat is one interface layer.
- It is not a content provider. It works with the learner's own content.

---

## Supported Goal Types

| Goal Type | Examples |
|-----------|---------|
| Competitive Exams | NEET, JEE, UPSC, SAT, MCAT, USMLE, Bar Exam, GMAT, GRE |
| School / College Courses | Physics A-Level, AP Calculus, Linear Algebra, History |
| Professional Certifications | CFA, CPA, AWS, PMP, CISSP |
| Coding / Technical Skills | Data Structures, Python, System Design |
| Language Learning | Spanish, French, Japanese, Mandarin |
| Custom Goals | Anything the user defines |

---

## Core Subsystems

| System | Role |
|--------|------|
| **ATLAS** | Knowledge map — what exists in the domain, what the learner knows |
| **MEMORY** | Spaced repetition engine — when to review what |
| **AUTOPSY** | Mistake diagnosis — why answers were wrong, what to fix |
| **COMMAND** | Daily mission — what to do today, in what order |
| **MIND** | AI tutor — chat, Q&A, explanation, practice questions |
| **PULSE** | Learning analytics — progress, streaks, mastery trends |

---

## Architecture Principles

1. **Universality first.** Every core system accepts any learning domain. Presets layer domain-specific context on top.
2. **Determinism over AI.** All structural decisions (what to study, when, in what order) are deterministic code. AI writes display prose only.
3. **Cheap by default.** AI usage is budgeted and gated. The system degrades gracefully to deterministic behavior when budgets are exceeded.
4. **Goal-scoped data.** All learner data is scoped to a goal, not a global user bucket. A user can run multiple active goals simultaneously.
5. **Presets are plugins.** Adding a new learning domain requires only adding a `GoalPreset` entry — no architectural changes.
6. **No fake features.** Every button, card, and data point is backed by real implementation.

---

## Goal Preset Model

```
GoalPreset {
  id: string                        // unique identifier
  name: string                      // human-readable name
  goal_type: GoalType               // 'exam' | 'course' | 'skill' | 'language' | 'custom'
  default_subjects: string[]        // initial subject seeds
  assessment_style: AssessmentType  // how progress is measured
  scoring_model: ScoringModel       // max score, negative marking, etc.
  common_mistake_tags: ...          // domain-appropriate error categories
  onboarding_questions: ...         // what to ask new users
  prompt_context: string            // injected into AI chat context
  dashboard_labels: ...             // label overrides for this domain
}
```

See `lib/types/universal-domain.ts` for the full type definition and built-in preset registry.

---

## Data Model

```
User
  └── LearningGoal (many, each with a preset)
        ├── Concepts (knowledge units, ATLAS)
        ├── RevisionCards (MEMORY engine)
        ├── StudySessions (learning history)
        ├── Mistakes (AUTOPSY results)
        ├── DailyMicrotasks (COMMAND output)
        └── StudyMaterials (uploaded sources)
```

---

## What NEET users get

NEET users get the full power of Cognition OS, configured for their domain:
- Physics, Chemistry, Biology subjects pre-seeded
- 720-mark scoring model
- NCERT-aligned chapter taxonomy in ATLAS
- NEET MCQ-appropriate practice format
- Mock test autopsy with negative marking analysis

They do not get a special codebase. They get the NEET preset applied to the universal architecture.

---

## Roadmap (Phase 2)

- [ ] Goal type column in DB (`profiles.goal_type`, `learning_goals.goal_type`)
- [ ] ATLAS expansion for non-NEET knowledge domains (coding, language, finance)
- [ ] Preset-driven chat context injection in MIND
- [ ] Assessment autopsy for non-MCQ formats (coding challenges, essays)
- [ ] Multi-goal dashboard with per-goal COMMAND cards
- [ ] Settings: change goal type post-onboarding
- [ ] Preset marketplace (community-contributed presets)
