import { createClient } from '@/lib/supabase/server';
import { generateText } from '@/lib/ai/provider-client';
import { logger } from '@/lib/utils/logger';

interface ClosingMessageInput {
  userId: string;
  conceptId: string | null;
  subject: string;
  chapter: string;
  gapFound: string | null;
  gapAnswer: string | null;
  understood: boolean;
  turnsCount: number;
  oldMastery: number | null;
  newMastery: number | null;
  cardsCreated: number;
  sessionId: string;
}

interface ClosingMessage {
  text: string;
  type: 'success' | 'partial' | 'gap_identified';
}

// Fetch most recent autopsy mistake matching this concept/subject
async function getRelatedAutopsyMistake(
  userId: string,
  subject: string,
  chapter: string
): Promise<{ date: string; description: string } | null> {
  const supabase = await createClient();

  // Since autopsy_questions does not have user_id directly, fetch user's mock_autopsies first
  const { data: autopsies } = await supabase
    .from('mock_autopsies')
    .select('id')
    .eq('user_id', userId);

  if (!autopsies || autopsies.length === 0) return null;
  const autopsyIds = autopsies.map(a => a.id);

  const { data } = await supabase
    .from('autopsy_questions')
    .select('created_at, subject, chapter, mistake_category, suggested_fix')
    .in('autopsy_id', autopsyIds)
    .eq('status', 'Incorrect')
    .ilike('subject', `%${subject}%`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  const description = data.suggested_fix?.slice(0, 120) || `${data.mistake_category || 'Incorrect answer'} in ${data.chapter || chapter}`;

  return {
    date: new Date(data.created_at).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'long'
    }),
    description,
  };
}

// Get due card count for tomorrow
async function getDueCardCount(userId: string): Promise<number> {
  const supabase = await createClient();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(23, 59, 59);

  const { count } = await supabase
    .from('revision_cards')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .lte('due', tomorrow.toISOString());

  return count || 0;
}

export async function generateSessionClosingMessage(
  input: ClosingMessageInput
): Promise<ClosingMessage> {
  const {
    userId, conceptId, subject, chapter,
    gapFound, understood, turnsCount,
    oldMastery, newMastery, cardsCreated, sessionId
  } = input;

  try {
    const [relatedMistake, dueCards] = await Promise.all([
      getRelatedAutopsyMistake(userId, subject, chapter),
      getDueCardCount(userId),
    ]);

    const masteryChange = oldMastery !== null && newMastery !== null
      ? Math.round((newMastery - oldMastery) * 100)
      : null;

    const masteryOldPct = oldMastery !== null ? Math.round(oldMastery * 100) : null;
    const masteryNewPct = newMastery !== null ? Math.round(newMastery * 100) : null;

    // Build a data-rich prompt so Gemini writes the message like a real coach
    const prompt = `You are the closing message writer for Cognition OS, an AI study OS.

Write a SHORT (3-5 sentences max) personalized closing message for a student who just finished a study session.

Tone: Direct, warm, coach-like. Like a mentor who genuinely knows this student. Not generic.
Format: Plain text only. No bullet points. No headers. No markdown.

Session data:
- Subject: ${subject}
- Chapter/Concept: ${chapter}
- Student understood the concept: ${understood}
- Session turns (depth): ${turnsCount}
- Knowledge gap found: ${gapFound || 'None identified'}
- New flashcards created this session: ${cardsCreated}
- Mastery before session: ${masteryOldPct !== null ? `${masteryOldPct}%` : 'Unknown'}
- Mastery after session: ${masteryNewPct !== null ? `${masteryNewPct}%` : 'Unknown'}
- Related past autopsy mistake: ${relatedMistake ? `"${relatedMistake.description}" on ${relatedMistake.date}` : 'None found'}
- Revision cards due tomorrow: ${dueCards}

Rules:
1. If understanding was confirmed, open with what they nailed specifically.
2. If a gap was found, name it plainly — no sugarcoating.
3. If there's a related past mistake, reference it naturally ("same gap as your test on...").
4. If mastery changed, state the new number.
5. Close with one specific preview of what tomorrow should focus on.
6. Never say "Great job!" or "Excellent!" — be specific, not cheerleader-generic.

Write only the message. Nothing else.`;

    const messageText = await generateText(
      'flash',
      'You are the closing message writer for Cognition OS, an AI study OS.',
      prompt,
      0.7
    );

    if (!messageText) {
      // Deterministic fallback — never fails silently
      return buildFallbackMessage(subject, chapter, gapFound, understood, masteryNewPct, cardsCreated, dueCards);
    }

    const type = understood ? 'success' : gapFound ? 'gap_identified' : 'partial';

    // Save to DB for longitudinal reference
    const supabase = await createClient();
    await supabase.from('session_closing_messages').insert({
      user_id: userId,
      session_id: sessionId,
      message: messageText,
      type,
      created_at: new Date().toISOString(),
    }).then(({ error }) => {
      if (error) logger.warn('Failed to save closing message', { error: error.message });
    });

    return { text: messageText, type };

  } catch (err: any) {
    logger.error('generateSessionClosingMessage failed', err);
    return buildFallbackMessage(subject, chapter, gapFound, understood, null, cardsCreated, 0);
  }
}

function buildFallbackMessage(
  subject: string,
  chapter: string,
  gapFound: string | null,
  understood: boolean,
  masteryPct: number | null,
  cardsCreated: number,
  dueCards: number
): ClosingMessage {
  const parts: string[] = [];

  if (understood) {
    parts.push(`Good session on ${chapter}.`);
  } else if (gapFound) {
    parts.push(`Session complete. Gap identified in ${chapter}: ${gapFound.slice(0, 80)}.`);
  } else {
    parts.push(`Session complete — ${chapter} covered.`);
  }

  if (cardsCreated > 0) {
    parts.push(`${cardsCreated} card${cardsCreated > 1 ? 's' : ''} added to your revision queue.`);
  }

  if (masteryPct !== null) {
    parts.push(`${subject} mastery is now at ${masteryPct}%.`);
  }

  if (dueCards > 0) {
    parts.push(`${dueCards} card${dueCards > 1 ? 's' : ''} due tomorrow — don't skip them.`);
  }

  return {
    text: parts.join(' '),
    type: understood ? 'success' : 'gap_identified',
  };
}
