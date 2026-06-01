import { streamText } from '@/lib/ai/provider-client';
import { getMentorSystemPrompt, buildMentorContext } from '@/lib/ai/prompts/mentor';
import { createClient } from '@/lib/supabase/server';
import { getMINDContext } from '@/lib/engines/mind-engine';

export async function getMentorContext(userId: string) {
  const supabase = await createClient();

  const [profileRes, conceptsRes, mistakesRes, cardsRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).single(),
    supabase.from('concepts').select('mastery').eq('user_id', userId),
    supabase.from('mistakes').select('subject, chapter, category, marks_lost').eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
    supabase.from('revision_cards').select('due').eq('user_id', userId).lte('due', new Date().toISOString()),
  ]);

  const concepts = conceptsRes.data || [];
  const masteryValues: Record<string, number> = {
    not_started: 0, exposed: 15, developing: 40, proficient: 70, mastered: 90, automated: 98,
  };

  const stats = {
    total: concepts.length,
    mastered: concepts.filter(c => c.mastery === 'mastered' || c.mastery === 'automated').length,
    weak: concepts.filter(c => c.mastery === 'not_started' || c.mastery === 'exposed').length,
    overallMastery: concepts.length > 0
      ? Math.round(concepts.reduce((s, c) => s + (masteryValues[c.mastery] || 0), 0) / concepts.length)
      : 0,
    cardsDue: cardsRes.data?.length || 0,
  };

  return {
    profile: profileRes.data,
    stats,
    recentMistakes: mistakesRes.data || [],
  };
}

export async function* streamMentorResponse(
  userId: string,
  userMessage: string,
  chatHistory: any[],
  reservationId?: string
) {
  const { profile, stats, recentMistakes } = await getMentorContext(userId);
  const mindContext = await getMINDContext(userId, userMessage).catch(() => null);
  const context = buildMentorContext(profile, stats, recentMistakes);
  const rootGapContext = mindContext?.rootGapChains?.length
    ? `\n\n## Root Prerequisite Gap Chains\n${mindContext.rootGapChains
        .slice(0, 3)
        .map((chain: any) => `- ${chain.gapChain.join(' -> ')}`)
        .join('\n')}`
    : '';

  const historyText = chatHistory.slice(-10).map(m =>
    `${m.role === 'user' ? 'Student' : 'Mentor'}: ${m.content}`
  ).join('\n');

  const fullPrompt = `${context}${rootGapContext}\n\n## Chat History\n${historyText}\n\nStudent: ${userMessage}`;

  const sysPrompt = getMentorSystemPrompt(profile?.exam_type || 'CUSTOM');
  yield* streamText('flash', sysPrompt, fullPrompt, 0.8, reservationId);
}
