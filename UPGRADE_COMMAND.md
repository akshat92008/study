# MODULE UPGRADE: COMMAND — Daily Mission Engine

## Current State: 75% → Target: 95%

---

## What Works Today
- AI-powered daily plan generator with 7 parallel data streams
- Adaptive workload (0.4x–1.2x) based on emotional state
- FSRS due card prioritization
- Heuristic fallback planner (zero-downtime)
- Task toggle with IDOR prevention
- DailyBriefing + PlannerDashboard UI

---

## Upgrade 1: Morning Briefing Narrative

**Problem:** Vision describes "Good morning. You have 73 days to your exam. Today: ..." — a personalized narrative greeting, not just a task list.

**Files to create/modify:**
- `lib/ai/agents/planner.ts` — Add `generateMorningBriefing()` function
- `components/planner/DailyBriefing.tsx` — Add narrative card at top

**Implementation:**
```typescript
export async function generateMorningBriefing(userId: string) {
  // Fetch: profile, days to exam, yesterday's completion %, PULSE state, due cards
  const prompt = `Generate a personalized morning briefing for this student.
    Days to exam: ${daysRemaining}
    Yesterday's completion: ${completionRate}%
    Cognitive state: ${emotionalState}
    Due revision cards: ${dueCards}
    Top weak area: ${topWeakArea}
    
    Format: A warm, direct 3-sentence greeting. Include exact hours recommended.
    Tone: Mentor, not machine. Reference yesterday's performance.`;
  
  return generateText('flash', 'You are COMMAND, the daily mission AI.', prompt);
}
```

**Estimated effort:** 3–4 hours

---

## Upgrade 2: Overnight Cron Synthesis

**Problem:** No scheduled job runs overnight to prepare the next day's plan.

**Files to create:**
- `app/api/cron/daily-synthesis/route.ts` — Vercel cron endpoint
- `vercel.json` — Cron schedule config

**Implementation:**
```typescript
// app/api/cron/daily-synthesis/route.ts
export async function GET(req: Request) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Fetch all active users
  const { data: users } = await supabase.from('profiles')
    .select('id').eq('onboarding_complete', true);

  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  
  for (const user of users || []) {
    await generateDailyPlan(user.id, tomorrow);
    await syncStudentModel(user.id); // Inference engine
  }
  
  return Response.json({ processed: users?.length || 0 });
}
```

```json
// vercel.json
{
  "crons": [{
    "path": "/api/cron/daily-synthesis",
    "schedule": "0 3 * * *"
  }]
}
```

**Estimated effort:** 4–5 hours

---

## Upgrade 3: Time-Slot Scheduling

**Problem:** `scheduled_start_time` exists in schema but planner doesn't assign specific times.

**Files to modify:**
- `lib/ai/agents/planner.ts` — Add time-slot assignment to the prompt
- `lib/engines/planner-schemas.ts` — Add `scheduled_start_time` to Zod schema

**Implementation:** Add to the MISSION RULES in the prompt:
```
6. TIME SLOTS: Assign each task a "scheduled_start_time" in "HH:mm" 24hr format.
   Start from the student's typical wake time and schedule sequentially with breaks.
```

**Estimated effort:** 1–2 hours

---

## Upgrade 4: Exam Countdown Integration

**Problem:** No prominent "X days remaining" display using the `exam_date` field.

**Files to modify:**
- `components/dashboard/CommandCenter.tsx` — Add countdown badge
- `components/planner/DailyBriefing.tsx` — Show days remaining in header

**Estimated effort:** 1–2 hours

---

## Total Estimated Effort: 9–13 hours
