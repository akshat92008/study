# Real MVP Manual Playbook

For each scenario, record the request ID or trace ID, relevant database rows, and visible UI result.

| Scenario | Steps | Expected durable state | Failure sign |
| --- | --- | --- | --- |
| Onboarding and goal | Create a learner and the Circulatory System Biology goal, refresh, navigate away and back. | `profiles.active_goal_id` references the owned goal. | Goal disappears or chat becomes goal-less. |
| Source lifecycle | Upload a valid source and wait for indexing. Ask a source-answerable question. | Material status is ready, chunks exist, chat metadata lists chunk IDs. | Source claim without chunk IDs or endless indexing. |
| Daily session | Load dashboard twice for the same goal/date. | One `session_cards` row is returned both times. | Duplicate cards or infinite loading. |
| Correct practice | Create a structured set and submit one correct answer twice with one idempotency key. | One attempt/event; mastery increases; trace succeeds. | Duplicate events or unchanged dashboard. |
| Wrong practice | Submit an incorrect answer. | Mistake and concept-linked revision card exist; dashboard counts change. | Success response without mistake/MEMORY state. |
| MEMORY review | Review the due card. | Review event, new due date, and mastery update exist. | Card count changes without event/mastery update. |
| Autopsy parse failure | Upload unparseable content or attempt a report with zero answers. | Assessment is `parsing_failed`; no diagnosis/recovery rows. | `needs_review`, recovery, or report success. |
| Autopsy success | Enter one wrong answered question, diagnose, and project. | Diagnosis, event, weaker mastery, revision card, and adaptive session target exist. | Projected status without all writes. |
| Refresh persistence | Refresh dashboard and chat after learning actions. | Same active goal; new learner state appears in MIND snapshot. | Local-only state or stale context. |
| Admin boundary | Open `/admin` and `/api/admin/*` as learner, then as admin. | Learner blocked; admin allowed. | Hidden navigation is the only protection. |
| Cross-user boundary | Try to read or mutate another learner's goal, practice, source, Autopsy, MEMORY, and session rows. | RLS/API ownership rejects every attempt. | Any foreign row is returned or changed. |
| Quota failure | Exhaust each limited feature and retry. | No orphan resource; usage is released or failed. | Durable row/file without entitlement. |
| Retry and double click | Repeat practice, session completion, Autopsy projection, and source callback concurrently. | Same result; no duplicate events/cards/streak. | Row count or mastery changes twice. |
| Slow network and workers | Delay responses and fail a worker once. | Visible pending/failed state and retry trace. | Fake success, stale spinner, or silent loss. |
