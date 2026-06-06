# Beta Agentic QA

Use this checklist before enabling Amaura agents for beta traffic.

1. Create a goal from the UI or `/api/goals`.
2. Confirm the goal appears in Active Goals.
3. Confirm Amaura creates initial `daily_microtasks`.
4. Confirm Today's Mission shows the first linked task.
5. Complete the mission task.
6. Confirm a `learning_evidence` completion row exists.
7. Complete a task with a weak topic.
8. Confirm Amaura creates a repair task for that weak topic.
9. Confirm Today's Mission changes to the repair task when it is highest priority.
10. Confirm an Amaura notification explains the plan update.
11. Replay the same goal/task event and confirm tasks, observations, and notifications are not duplicated.
12. Open the admin dashboard and confirm agent run metrics do not crash on empty tables.
13. Set `ENABLE_AMAURA_AGENTS=false` and confirm new goal creation still succeeds while decomposition is skipped.
14. Confirm user-facing pages do not expose raw event consumer names or legacy Hermes labels.
