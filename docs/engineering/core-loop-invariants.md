# Cognition OS Core-Loop Invariants

1. Goal-aware routes resolve the active goal on the server. Browser storage is only a cache.
2. Each practice answer, revision review, session completion, Autopsy projection, focus completion, or manual mistake review creates one idempotent canonical learner event.
3. Concept-bearing events resolve a non-placeholder concept. Blank, `unknown`, `n/a`, `none`, `undefined`, and `null` concepts are rejected.
4. Graded evidence changes canonical `concepts.mastery_score`, or returns a specific projection failure.
5. Incorrect or recoverable evidence creates or updates a revision card with `concept_id`.
6. Incorrect evidence creates canonical mistake state read by the dashboard.
7. At most one session card exists for user, local date, and goal/null.
8. Goal A writes never mutate Goal B learner state.
9. Dashboard mastery comes from `concepts.mastery_score`, the same field used by projectors.
10. Every MIND turn reloads current mastery, memory, mistakes, sources, recent events, and the daily session.
11. Autopsy cannot report recovery or projection with zero learner answers or zero diagnoses.
12. MIND may claim source grounding only when retrieved chunk IDs exist.
13. Required projection failure returns `ok:false`; the UI cannot receive a success payload.
14. Admin pages and APIs require server-side administrator authorization.
15. PULSE is excluded from user-facing MVP runtime and release gates.
16. Core mutations are idempotent, traceable, and safe to retry.
17. Quota is reserved before expensive durable work and committed or released explicitly.
18. The production gate remains blocked unless tests, contracts, schema checks, security checks, smoke proof, and build pass.
