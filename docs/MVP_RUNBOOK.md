# Cognition OS - MVP Runbook

This runbook helps founders run, test, demo, and debug the Cognition OS MVP locally without relying on engineering.

## 1. Setting Up Environment Variables
1. Copy `.env.example` to `.env.local`
2. Ensure the following are set:
   - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `GEMINI_API_KEY`
   - `INTERNAL_INTERNAL_CRON_SECRET`
   - `UPSTASH_REDIS_REST_URL` & `UPSTASH_REDIS_REST_TOKEN` (required for production)
   - `NODE_ENV` (development for local)

## 2. Running Migrations
To ensure your database is up to date with the latest schema:
```bash
npm run supabase:start
npm run supabase:push
```

## 3. Validating the Setup
Run the following checks to ensure code health and schema safety:
```bash
npm run typecheck       # Checks for TypeScript errors
npm run test            # Runs unit tests
npm run audit:schema    # Audits the database schema and queries
npm run smoke:mvp       # Runs the automated MVP smoke check
```

## 4. Seeding Local Demo Data
To quickly test the app without manual entry, seed demo data:
1. Ensure `DEMO_SEED_ALLOWED=true` in your `.env.local`
2. Run the seed script:
```bash
npm run seed:mvp
```
This safely creates a dummy profile, concepts, and an autopsy without affecting real users.

## 5. Debugging Events (Async Workers)
If mock autopsies or background processing seems stuck:
```bash
npm run debug:events
```
This shows pending/failed/stuck events and recent errors in the event bus.

**What to do if event worker fails?**
- Check the error message in the output of `debug:events`.
- Look for API key errors (e.g., Gemini) or missing concepts in the DB.
- Events will auto-retry based on their configuration, but you can manually re-trigger by setting `status = 'pending'` in Supabase for the event.

## 6. Debugging a Single User
If a user reports an issue or you want to see exactly what state the MVP has inferred for them:
```bash
npm run debug:user <USER_ID>
```
*(You can find the USER_ID in the Supabase Auth or Profiles table.)*

**What DB rows should exist after core actions?**
- **After a Chat Session:** 1 row in `chat_sessions`, multiple rows in `chat_messages`, new or updated rows in `chat_memory`, possible updates to `concepts` mastery.
- **After Session Card:** 1 row in `study_tasks` marked as completed.
- **After Autopsy:** 1 row in `mock_autopsies` (completed), multiple rows in `mistakes`, new/updated `concepts`.

**What to do if autopsy upload fails?**
- Verify the file is accessible or text is correctly extracted.
- Ensure the async event bus worker is running (if using a cron, you can manually ping the processing endpoint).
- Use `npm run debug:events` to check the error trace.

**What to do if chat memory is missing?**
- Memory extraction usually happens asynchronously at the end of the session. Check if the "End Session" was explicitly called or if there's a failed event in `student_events`.

## 7. Manually Verifying the Browser MVP Loop
For manual QA, open the `docs/MVP_BROWSER_QA_CHECKLIST.md` file and follow the step-by-step checklist to ensure the frontend is responding as expected.
