import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { validateCronRequest } from '@/lib/middleware/cronAuth';
import { budgetedGenerateJSON } from '@/lib/ai/budgeted';

export const maxDuration = 300;
export const GET = POST;

export async function POST(req: NextRequest) {
  const authError = validateCronRequest(req);
  if (authError) return authError;

  const supabase = createAdminClient();
  const results: Record<string, number> = {
    usersProcessed: 0,
    errors: 0,
  };

  try {
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('id, name')
      .limit(100); 

    if (usersError) throw usersError;

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const weekStart = new Date(Date.now() - new Date().getDay() * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    for (const user of users || []) {
      try {
        const [mistakesRes, autopsiesRes, conceptsRes] = await Promise.all([
          supabase.from('mistakes').select('concept_name, severity')
            .eq('user_id', user.id)
            .gte('created_at', sevenDaysAgo),
          supabase.from('mock_autopsies').select('current_score, exam_type')
            .eq('user_id', user.id)
            .gte('created_at', sevenDaysAgo),
          supabase.from('concepts').select('concept, mastery_score')
            .eq('user_id', user.id)
            .gte('updated_at', sevenDaysAgo)
        ]);

        const mistakes = mistakesRes.data || [];
        const autopsies = autopsiesRes.data || [];
        const concepts = conceptsRes.data || [];

        if (mistakes.length === 0 && autopsies.length === 0 && concepts.length === 0) {
          continue; // No activity
        }

        const prompt = `You are an elite learning analyst for Cognition OS.
Analyze this student's past 7 days of activity and write a 2-3 sentence narrative summarizing their week. Focus on their journey, what improved, and what they need to watch out for.

Activity Data:
- Concepts updated: ${JSON.stringify(concepts.map(c => c.concept))}
- Mistakes made: ${JSON.stringify(mistakes)}
- Autopsies/Tests taken: ${autopsies.length}
`;

        const synthesis = await budgetedGenerateJSON<{ narrative: string }>({
          userId: user.id,
          feature: 'session-analysis',
          route: 'cron:weekly-synthesis',
          model: 'flash',
          systemPrompt: 'You are an elite learning analyst. Output exactly in JSON format { "narrative": "your narrative here" }',
          userPrompt: prompt,
          maxOutputTokens: 200,
        });

        if (synthesis?.narrative) {
          await supabase.from('weekly_syntheses').upsert({
            user_id: user.id,
            week_start_date: weekStart,
            narrative_text: synthesis.narrative,
          }, { onConflict: 'user_id, week_start_date' });
          results.usersProcessed++;
        }
      } catch (err) {
        console.error(`[Weekly Synthesis] Error processing user ${user.id}:`, err);
        results.errors++;
      }
    }

    console.log('[Weekly Synthesis] Results:', results);
    return NextResponse.json({ ok: true, ...results });
  } catch (err: any) {
    console.error('[Weekly Synthesis] Fatal error:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
