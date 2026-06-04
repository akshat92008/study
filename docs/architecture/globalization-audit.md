# Cognition OS — Globalization Audit
**Status:** ACTIVE — Phase 1 (Discovery → Implementation)  
**Last Updated:** 2026-06-04

---

## Summary

Cognition OS was originally built as a NEET-focused exam preparation tool. This audit documents all hardcoded NEET/JEE/PCB/NCERT assumptions discovered in the codebase, and tracks which ones have been resolved, which are still open, and which are acceptable scope-limited items.

**Mission:** Transform Cognition OS into a **universal, subject-agnostic AI-native learning OS**. NEET must be one optional preset, not the architectural identity.

---

## Phase 1 Findings — Hardcoded Domain Assumptions

### HIGH SEVERITY (Product Identity / Architecture)

| # | File | Finding | Status |
|---|------|---------|--------|
| H1 | `app/(dashboard)/onboarding/page.tsx` | Default `examType = "NEET"`, subjects hardcoded to `"Physics, Chemistry, Biology"` | ✅ FIXED |
| H2 | `app/api/autopsy/manual/route.ts` | LLM prompt forces subject list `"Physics" \| "Chemistry" \| "Biology" \| "Maths"` — NEET-only | ✅ FIXED |
| H3 | `app/api/autopsy/ingest/route.ts` | Default test name `"Mock Test Autopsy"` — exam-specific identity | ✅ FIXED |
| H4 | `app/api/dashboard/session-card/route.ts` | LLM prose prompt hardcodes `"competitive exam student"` context | ✅ FIXED |
| H5 | `app/api/planner/briefing/route.ts` | Briefing response uses `examType` field — NEET-centric framing | ✅ FIXED |

### MEDIUM SEVERITY (UI Copy / Naming)

| # | File | Finding | Status |
|---|------|---------|--------|
| M1 | `app/(dashboard)/dashboard/page.tsx` | "Analyze Another **Mock Test**" button — exam-specific | ✅ FIXED |
| M2 | `app/(dashboard)/dashboard/page.tsx` | "mock tests" in Study Profile description | ✅ FIXED |
| M3 | `app/api/materials/upload/route.ts` | Source type list includes `"ncert"` as hardcoded value | ✅ FIXED (remapped to `"textbook"`, backward-compat alias kept) |
| M4 | `lib/engines/autopsy-schemas.ts` | No NEET-specific content but `AutopsyPaperSchema` has `subject: z.string()` with no guidance — inherits NEET mental model from usage | 🔲 OPEN (acceptable — schema is domain-agnostic) |
| M5 | Multiple routes | `profile.exam_type` used as goal identity | 🔲 OPEN (acceptable — DB field kept for backward compat) |
| M6 | `app/api/autopsy/route.ts` | `examType: autopsy.exam_type` in response — surfaced to UI as exam framing | 🔲 OPEN — low risk (value is dynamic from DB) |

### LOW SEVERITY / ACCEPTABLE

| # | File | Finding | Note |
|---|------|---------|------|
| L1 | DB schema: `profiles.exam_type` | Column name is exam-centric | Kept for backward compat. Application layer normalizes via `inferPresetFromExamType()`. |
| L2 | DB schema: `learning_goals.exam_type` | Column name is exam-centric | Same as above. `goal_type` added as a conceptual overlay. |
| L3 | `lib/engines/session-card-selector.ts` | Session card engine reads `exam_type` from profile | Acceptable — code treats it as an opaque string, no NEET-specific branching. |
| L4 | `lib/events/types.ts` | Event types are generic (`MATERIAL_UPLOADED`, etc.) | Already universal. No fix needed. |
| L5 | `lib/agents/types.ts` | Agent action types generic | Already universal. No fix needed. |
| L6 | `app/api/goals/route.ts` | `exam_type` in goal insert | Acceptable — value is user-supplied, not hardcoded. |

---

## Phase 1 Implementation

### New Files Created

- `lib/types/universal-domain.ts` — Universal domain model (`GoalType`, `KnowledgeUnitType`, `AssessmentType`, `GoalPreset`, etc.)
- `lib/config/flags.ts` — Extended with `globalOnboarding`, `presetNeet`, `assessmentAutopsy`, `agentLoop`, and `getBudgetMode()`
- `docs/architecture/globalization-audit.md` (this file)
- `docs/VISION.md` — Product vision document

### Files Modified

| File | Change |
|------|--------|
| `app/(dashboard)/onboarding/page.tsx` | Complete rewrite — universal goal/preset selector with 17 goal types |
| `app/api/autopsy/manual/route.ts` | LLM prompt: NEET subject list → universal subject inference |
| `app/api/autopsy/ingest/route.ts` | Default name: "Mock Test Autopsy" → "Assessment Autopsy" |
| `app/api/dashboard/session-card/route.ts` | LLM prompt: "competitive exam student" → uses goal title or exam type |
| `app/api/planner/briefing/route.ts` | Response: added `goalType` alias, kept `examType` for legacy compat |
| `app/api/materials/upload/route.ts` | Source types: `ncert` → normalized to `textbook` |
| `app/(dashboard)/dashboard/page.tsx` | UI copy: "Mock Test" → "Assessment" in two places |

---

## Phase 2 — Open Work

### Still Required

| Priority | Area | Description |
|----------|------|-------------|
| HIGH | DB Migration | Add `goal_type` column to `profiles` and `learning_goals` tables. `exam_type` is backward compat alias. |
| HIGH | ATLAS (Knowledge Map) | `lib/atlas/` uses `chapter` and `subject` heavily — needs to accept `knowledge_unit_type` from preset |
| HIGH | Chat system prompt | `lib/ai/agents/mind.ts` or equivalent — inject goal/preset context from `activeGoal.title` |
| MEDIUM | Autopsy engine schemas | `AutopsyPaperSchema` should accept `assessmentType` field for non-exam assessments |
| MEDIUM | Dashboard UI | Study Profile card should display goal title, not just `exam_type` string |
| MEDIUM | Session card engine | `lib/engines/session-card-selector.ts` — use `GoalPreset.scoring_model` for score display |
| LOW | Admin dashboard | Goal type breakdown metrics |
| LOW | Settings page | Allow users to update their goal type after onboarding |

---

## Non-Negotiable Rules Going Forward

1. **NEET is ONE preset** in `GOAL_PRESETS` in `lib/types/universal-domain.ts`. It does not get default privilege in any code path.
2. **`profile.exam_type` is a DB compat field** — application code must use `inferPresetFromExamType()` to get the preset, not branch on raw `exam_type` strings.
3. **LLM prompts must not hardcode exam names or subject lists.** Subjects must come from user data or be inferred from context.
4. **UI copy must not contain "Mock Test" as a product noun.** Use "Assessment", "Test", "Quiz", or a preset-defined label.
5. **AI is used only where needed.** All structural decisions (card selection, task type, priority) are deterministic. AI only writes display prose.
6. **No fake features.** If a feature is not implemented, it is gated by `featureFlags` and not surfaced in the UI.

---

## Preset Registry

All presets live in `lib/types/universal-domain.ts` in `GOAL_PRESETS`. Current presets:

| Preset ID | Name | Goal Type |
|-----------|------|-----------|
| `custom_learning_goal` | Custom Learning Goal | `custom` |
| `competitive_exam_generic` | Competitive Exam (Generic) | `exam` |
| `school_or_college_course` | School / College Course | `course` |
| `coding_skill` | Coding / Technical Skill | `skill` |
| `language_learning` | Language Learning | `language` |
| `neet_ug` | NEET UG | `exam` |
| `jee_main` | JEE Main | `exam` |

Adding new presets: add an entry to `GOAL_PRESETS` with all required fields. No code changes elsewhere needed.
