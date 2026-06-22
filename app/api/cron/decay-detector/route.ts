import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { validateCronRequest } from '@/lib/middleware/cronAuth';

export const maxDuration = 300;
export const GET = POST;

export async function POST(req: NextRequest) {
  const authError = validateCronRequest(req);
  if (authError) return authError;

  const supabase = createAdminClient();
  const results: Record<string, number> = {
    conceptsChecked: 0,
    notificationsSent: 0,
    errors: 0,
  };

  try {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

    // Query concepts with high forgetting probability that haven't been reviewed recently
    const { data: decayingConcepts, error } = await supabase
      .from('concepts')
      .select('id, user_id, concept, mastery_score, forgetting_probability, last_reviewed_at')
      .gt('forgetting_probability', 0.7)
      .lt('last_reviewed_at', threeDaysAgo)
      .limit(500);

    if (error) throw error;
    
    results.conceptsChecked = decayingConcepts?.length || 0;

    for (const concept of decayingConcepts || []) {
      try {
        const message = `Your mastery of '${concept.concept}' is decaying (probability of forgetting is ${Math.round(concept.forgetting_probability * 100)}%). A quick review will boost it back up.`;
        
        await supabase.from('amaura_notifications').insert({
          user_id: concept.user_id,
          type: 'mastery_decay',
          title: 'Mastery Decaying',
          message: message,
          action_url: '/dashboard?action=review',
          dedup_key: `decay_${concept.id}_${new Date().toISOString().split('T')[0]}`,
        });

        results.notificationsSent++;
      } catch (err) {
        console.error(`[Decay Detector] Error processing concept ${concept.id}:`, err);
        results.errors++;
      }
    }

    console.log('[Decay Detector] Results:', results);
    return NextResponse.json({ ok: true, ...results });
  } catch (err: any) {
    console.error('[Decay Detector] Fatal error:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
