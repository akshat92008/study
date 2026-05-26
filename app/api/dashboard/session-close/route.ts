import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateSessionClosingMessage } from '@/lib/engines/session-closing';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const {
    conceptName,
    subject,
    sessionDurationMinutes,
    understood = false,
    gapFound = null,
    cardsCreated = 0,
  } = await req.json();

  // 1. Update streak based on last_study_date
  const today = new Date().toISOString().split('T')[0];
  const { data: profile } = await supabase
    .from('profiles')
    .select('streak_days, last_study_date')
    .eq('id', user.id)
    .single();

  const lastStudy = profile?.last_study_date;
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  let newStreak = 1;
  if (lastStudy === yesterday) {
    newStreak = (profile?.streak_days || 0) + 1;
  } else if (lastStudy === today) {
    newStreak = profile?.streak_days || 1; // already counted today
  }

  await supabase.from('profiles').update({
    streak_days: newStreak,
    last_study_date: today,
    updated_at: new Date().toISOString(),
  }).eq('id', user.id);

  // 2. Fetch concept details (id and current mastery)
  const { data: conceptRecord } = await supabase
    .from('concepts')
    .select('id, mastery')
    .eq('user_id', user.id)
    .ilike('name', `%${conceptName}%`)
    .maybeSingle();
  const conceptId = conceptRecord?.id ?? null;
  const oldMastery = conceptRecord?.mastery ?? null;

  // 3. Log the study session and capture its ID
  const { data: sessionRecord } = await supabase
    .from('study_sessions')
    .insert({
      user_id: user.id,
      topic: conceptName,
      concept_name: conceptName,
      subject: subject,
      duration_minutes: sessionDurationMinutes,
      understood: understood,
      gap_found: gapFound,
      cards_created: cardsCreated,
      completed_at: new Date().toISOString(),
    })
    .select('id')
    .maybeSingle();
  const sessionId = sessionRecord?.id ?? '';

  // 4. Generate closing message
  const closing = await generateSessionClosingMessage({
    userId: user.id,
    conceptId,
    subject: subject || 'General',
    chapter: conceptName || 'General Study',
    gapFound,
    gapAnswer: null,
    understood,
    turnsCount: 0,
    oldMastery,
    newMastery: oldMastery,
    cardsCreated,
    sessionId,
  });

  // 5. Return response
  return NextResponse.json({
    newStreak,
    closingMessage: closing.text,
    messageType: closing.type,
    oldMastery,
    newMastery: oldMastery,
    cardsCreated,
  });
}
