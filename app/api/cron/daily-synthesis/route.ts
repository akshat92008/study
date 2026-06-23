import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { validateCronRequest } from '@/lib/middleware/cronAuth';
import { getLearnerStateSnapshot } from '@/lib/learner-state/getLearnerState';
import { selectSessionCard } from '@/lib/engines/session-card-selector';

export const maxDuration = 300; // 5 minutes max
export const GET = POST;

export async function POST(req: NextRequest) {
  const authError = validateCronRequest(req);
  if (authError) return authError;

  const supabase = createAdminClient();
  const results: Record<string, number> = {
    usersProcessed: 0,
    notificationsSent: 0,
    errors: 0,
  };

  try {
    // 1. Fetch active users (e.g., users who have logged in within the last 30 days)
    // For now, we fetch all users or a subset if we had last_active tracking
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('id, name')
      .limit(100); // Batch limit for safety, real prod should use pagination

    if (usersError) throw usersError;

    for (const user of users || []) {
      results.usersProcessed++;
      try {
        // 2. Fetch their full learner state
        const state = await getLearnerStateSnapshot(user.id, {
          client: supabase,
        });

        // 3. Determine today's mission
        const sessionCard = selectSessionCard({
          now: new Date().toISOString(),
          profile: {
            id: user.id,
            exam_type: state.profile.examType,
            target_date: state.profile.examDate,
            streak_days: state.profile.streakDays,
            timezone: state.profile.timezone,
            onboarding_complete: true,
          },
          activeGoal: state.activeGoal ? {
            id: state.activeGoal.id,
            title: state.activeGoal.title,
            target_date: state.activeGoal.targetDate,
            progress: state.activeGoal.progress ?? 0,
          } : null,
          overdueCardCount: state.memory.dueCount,
          topDueCard: state.memory.topDueCards.length > 0 ? {
            id: state.memory.topDueCards[0].id,
            subject: null, chapter: null, concept_id: null,
            difficulty: 0, lapses: 0,
          } : null,
          recentMistakes: state.autopsy.recentMistakes.map(m => ({
            id: m.id,
            subject: m.subject,
            topic: m.topic ?? null,
            chapter: m.chapter,
            concept: m.concept ?? null,
            concept_id: m.concept_id ?? null,
            category: m.category,
            mistake_type: m.mistake_type,
            mistake_text: m.mistake_text ?? null,
            severity: m.severity ?? null,
            status: m.status ?? null,
            exam_trap: m.exam_trap ?? null,
            next_retest_at: m.next_retest_at ?? null,
            created_at: m.created_at || new Date().toISOString(),
          })),
          weakConcepts: state.atlas.weakConcepts.map(c => ({
            id: c.id,
            name: c.name,
            subject: c.subject,
            chapter: c.chapter,
            mastery: c.mastery,
            mastery_score: c.mastery_score ?? null,
            forgetting_probability: c.forgetting_probability ?? null,
            times_reviewed: c.times_reviewed ?? null,
          })),
          sessionCount: state.recentStudySessions.length,
          studentModel: null, // Ignored for generic synthesis
          commandOpenTasks: state.command.openTasks as any,
          dueRetests: state.autopsy.dueRetests as any,
          patternMemories: state.hermesMemories as any,
          firstSeededTopic: state.seededTopics[0] as any ?? null,
        });

        // 4. Generate the notification
        const dueCardsCount = state.memory.dueCount;
        const hermesReminders = state.hermesMemories || [];
        
        let message = `Good morning ${user.name || 'there'}! `;
        
        if (sessionCard && sessionCard.topic) {
          message += `Your mission today: ${sessionCard.topic}. `;
        } else {
          message += `Ready for a new learning goal? `;
        }

        if (dueCardsCount > 0) {
          message += `You have ${dueCardsCount} revision cards due. `;
        }

        if (hermesReminders.length > 0) {
          message += `Don't forget: ${hermesReminders[0].action_type} `;
        }

        // 5. Insert into amaura_notifications
        await supabase.from('amaura_notifications').insert({
          user_id: user.id,
          type: 'daily_plan',
          title: 'Your Daily Plan',
          message: message.trim(),
          action_url: '/dashboard',
          dedup_key: `daily_plan_${new Date().toISOString().split('T')[0]}_${user.id}`,
        });

        results.notificationsSent++;
      } catch (err) {
        console.error(`[Daily Synthesis] Error processing user ${user.id}:`, err);
        results.errors++;
      }
    }

    console.log('[Daily Synthesis] Results:', results);
    return NextResponse.json({ ok: true, ...results });
  } catch (err: any) {
    console.error('[Daily Synthesis] Fatal error:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
