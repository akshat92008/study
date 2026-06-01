# Cognition OS — Production Deployment Checklist

Follow this exact 10-step sequence to go from the current state to a production-ready release. Do not skip or reorder steps.

---

### Step 1 — Environment Setup
- [ ] Set every required environment variable in `.env.local` and in your Vercel project settings:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `GEMINI_API_KEY`
  - `NEXT_PUBLIC_APP_URL`
- [ ] Verify validation locally:
  - Run the application locally (`npm run dev`) or build it (`npm run build`).
  - Confirm the console output has no `validateEnvironment()` crashes or missing variable warnings.

---

### Step 2 — Database Security & RLS Enforcement
- [ ] Ensure all migrations have been applied using Supabase CLI or GitHub Actions.
- [ ] Verify that RLS is active on all critical tables. Execute the following verification query and confirm it returns **zero rows**:
  ```sql
  SELECT tablename, rowsecurity
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename IN (
      'profiles','concepts','revision_cards','study_tasks',
      'mock_autopsies','mistakes','materials','chat_memories'
    )
    AND rowsecurity = false;
  ```
- [ ] Confirm row security is force-enabled on `profiles` to bypass RLS for service_role processes.

---

### Step 3 — Deploy & Verify FIX 001 (History Format)
- [ ] Deploy the history format changes to Vercel/Staging.
- [ ] Open the chat interface and have a **10-turn conversation** with the tutor.
- [ ] Confirm the AI references and builds upon earlier conversation turns correctly without context loss or repetition.

---

### Step 4 — Deploy & Verify FIX 002 (Cross-Session Memory)
- [ ] Confirm the `chat_memories` table exists in Supabase.
- [ ] Start a conversation, close the tab/browser, reopen, and ask the Socratic tutor about concepts discussed in the previous session.
- [ ] Verify that the past context is retrieved from `chat_memories` and used by the tutor.

---

### Step 5 — Deploy & Verify FIX 004 (ATLAS Syllabus Expansion)
- [ ] Deploy the dynamic syllabus expansion logic.
- [ ] Sign up with a new account and choose **NEET** as the exam type. Check the `concepts` table in Supabase to confirm **200+ rows** have been seeded across Physics, Chemistry, and Biology.
- [ ] Repeat the test using **CFA** as the exam type, and verify concepts are seeded across all CFA modules.

---

### Step 7 — Deploy Remaining P1 Fixes
- [ ] Package and deploy the remaining P1 updates together in a single pull request:
  - **FIX 005**: MIND → ATLAS Write-Back (unconditional concept mentions extraction).
  - **FIX 007**: Auto-card generation at onboarding completion.
  - **FIX 009**: Batched concurrent cron daily-synthesis processor.
  - **FIX 010**: Socratic Session card rendered at the top of the chat interface.

---

### Step 9 — End-to-End Student Journey Audit
Test the entire learning habit loop end-to-end:
1. **New Signup**: Register a new student profile.
2. **Onboarding**: Complete onboarding flow, quiz calibration, and optional document upload.
3. **Magic Moment**: Land on dashboard and confirm the Welcome Overlay fades out to reveal the active ATLAS graph.
4. **Daily Habit Loop**: Socratic Session card appears at the top of the chat interface.
5. **Start Session**: Chat triggers MIND Socratic dialogue.
6. **Mastery Updates**: Socratic conversation ends, writing back concept mastery updates to ATLAS.
7. **Memory Seeding**: Spaced repetition flashcards are automatically generated in MEMORY.
8. **Next Day Replan**: Tasks and study goals adapt for the following day.

---

### Step 10 — Production Monitoring & Alerts
- [ ] Connect a monitoring tool (such as Sentry or Logtail) to capture runtime errors.
- [ ] Configure slack/email alerts for any critical `logger.error` alerts or failed AI calls at scale.
