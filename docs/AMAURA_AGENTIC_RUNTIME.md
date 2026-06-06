# Amaura Agentic Runtime

Amaura is the native Cognition OS learning loop:

Goal -> Task -> Observation -> Evaluation -> Adaptation -> Next Action.

For beta, the runtime uses existing canonical tables instead of duplicate agent tables:

- `learning_goals` are Amaura goals.
- `daily_microtasks` are Amaura tasks.
- `learning_evidence` rows are Amaura observations.
- `session_cards` hold today's mission.
- `amaura_notifications`, `amaura_pattern_memories`, and `amaura_agent_runs` make changes visible and auditable.

## Event Matrix

The canonical TypeScript matrix lives in `lib/amaura/events/event-matrix.ts`.

Primary events include:

- `AMAURA_GOAL_CREATED`
- `AMAURA_TASK_COMPLETED`
- `AMAURA_TASK_SKIPPED`
- `AMAURA_OBSERVATION_RECORDED`
- `AUTOPSY_V3_REPORT_READY`
- `MEMORY_REVIEW_COMPLETED`
- `ATLAS_CONCEPT_UPDATED`
- `SESSION_CLOSED`
- `DAILY_AGENT_TICK`

Safe bounded consumers:

- `amaura_goal_decomposer`
- `amaura_plan_adapter`
- `amaura_progress_evaluator`
- `amaura_next_action`
- `amaura_practice_agent`
- `amaura_session_agent`
- `amaura_autopsy_cascade`
- `amaura_forgetting_agent`
- `amaura_stagnation_agent`
- `amaura_pattern_memory`

The SQL queue routing in `supabase/migrations/20260606120000_amaura_agentic_runtime.sql` mirrors this matrix for service-role event creation and bounded per-user leases.

## Native Agents

- `GoalDecomposerAgent`: decomposes a new goal into initial microtasks, session card, and notification.
- `ProgressEvaluatorAgent`: computes progress/risk from tasks and observations.
- `PlanAdapterAgent`: creates repair tasks and reschedules a bounded number of overdue tasks.
- `NextActionAgent`: selects the highest-value next pending task and updates today's mission.
- Existing practice, session, autopsy, forgetting, stagnation, and pattern-memory agents remain native Amaura agents.

Registered agents must write real state. No noop agents should be registered.

## Repositories

Repository wrappers centralize schema assumptions:

- `lib/amaura/goals/goal-repository.ts`
- `lib/amaura/tasks/task-repository.ts`
- `lib/amaura/observations/observation-repository.ts`
- `lib/amaura/session/session-card-repository.ts`
- `lib/amaura/notifications/notification-repository.ts`

Agents should prefer these wrappers over direct table operations.

## Budget And Kill Switches

Defaults remain rule-first and Hobby-safe.

- `ENABLE_AMAURA_AGENTS=true`
- `ENABLE_AGENT_RUNTIME=true`
- `ENABLE_AGENT_LLM_CALLS=false`
- `MAX_AGENT_AI_CALLS_PER_USER_PER_DAY=2`
- `MAX_AGENT_AI_CALLS_PER_USER_PER_MONTH=20`
- `MAX_AGENT_AI_CALLS_GLOBAL_PER_DAY=100`

`ENABLE_AMAURA_AGENTS=false` disables native Amaura execution through the same path as the existing runtime kill switch. Background LLM calls stay disabled unless explicitly enabled and budget checks pass.

## Idempotency

Task, observation, notification, and agent-run writes use event/source dedup keys. Replaying a handled goal/task event should not duplicate rows.

## Admin Observability

`app/api/admin/dashboard/route.ts` reads the shared safe bounded consumer list and reports:

- agent run counts
- failures
- AI usage
- notifications
- autopsy cascade health
- retry-safe failed jobs

Internal consumer names should remain admin-only.

## Failure Modes

Goal creation is production-safe: the user goal can be created even if decomposition fails. The failure is logged and visible through agent-run/admin telemetry where available.

## Local QA Checklist

1. Create a goal through `/api/goals`.
2. Confirm initial `daily_microtasks` rows exist.
3. Confirm today's `session_cards` row points at the first task.
4. Complete a linked microtask.
5. Confirm `learning_evidence` records completion.
6. Report a weak topic and confirm a repair task is created.
7. Confirm `amaura_notifications` has meaningful deduped updates.
8. Replay the same event/request and confirm no duplicates.
9. Set `ENABLE_AMAURA_AGENTS=false` and confirm decomposition is skipped.

## Beta Status

This implementation is agentic beta-ready for the goal/task/observation/next-action loop. It is not yet a fully agentic learning OS until chat intent, approvals, daily tick UI, and complete Memory/Atlas approval surfaces are fully productized end to end.
