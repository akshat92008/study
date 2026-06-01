# Private Beta Loop Manual Check

Use this after migrations are applied and the app is running locally.

1. Sign up or sign in as a fresh student.
2. Complete onboarding with:
   - Exam: `NEET`
   - Target score: `650`
   - Target date: `2026-05-03`
   - Daily available hours: `4`
   - Subjects: `Physics, Chemistry, Biology`
   - Current level: `intermediate`
3. Confirm the app redirects to `/chat`.
4. In MIND, send: `I am preparing for NEET 2026. I scored 420 in my last mock and I am weak in Electrochemistry and Plant Physiology.`
5. Send: `What should I do tomorrow?`
   - Expected: an inline COMMAND plan with specific tasks, not a dashboard requirement.
6. Upload or paste mock evidence with answer key/student answers.
   - Expected: if evidence is insufficient, AUTOPSY asks for the missing evidence and does not mutate learner state.
   - Expected with valid evidence: AUTOPSY queues or completes analysis, then worker updates ATLAS, MEMORY, COMMAND, and outcome analytics.
7. Run the event worker once through the secured cron/internal worker route.
8. Send: `What are my weakest areas?`
   - Expected: inline ATLAS answer from weak concepts/recent mistakes.
9. Send: `What should I revise now?`
   - Expected: inline MEMORY answer with due cards or an honest empty state.
10. Start `/mentor` or `/tutor`, discuss one weak concept, then return to `/chat`.
11. Start a new chat session and ask about the earlier struggle.
   - Expected: MIND recalls relevant semantic/episodic memory without mentioning PULSE.
12. Check `/api/analytics/outcomes`.
   - Expected: authenticated user-owned summary, with non-causal wording.
