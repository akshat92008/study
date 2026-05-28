// lib/engines/emotional-state-updater.ts
// Classifies mood from a student's message and updates profiles.emotional_state.
// Called from the chat route after every user message (non-blocking, fire-and-forget).
//
// HOW TO INSTALL:
// 1. Copy this file to: lib/engines/emotional-state-updater.ts
// 2. In app/api/ai/chat/route.ts, add the import at the top:
//       import { inferAndUpdateEmotionalState } from '@/lib/engines/emotional-state-updater';
// 3. In the `after(async () => { ... })` block inside the chat route,
//    after the chat_messages insert, add ONE line:
//       inferAndUpdateEmotionalState(user.id, message).catch(() => {});
//
// That's it. No other changes needed. The MIND prompt already reads
// emotional_state from profiles on every message — so the adaptation
// blocks (push harder / slow down / overwhelmed mode) will start working
// immediately once this file is live.

import { createClient } from '@/lib/supabase/server';
import { routeTextGeneration } from '@/lib/ai/router';
import { logger } from '@/lib/utils/logger';

// Only these values are valid in the emotional_state enum
type EmotionalState =
  | 'focused'
  | 'motivated'
  | 'stressed'
  | 'burnt_out'
  | 'anxious'
  | 'frustrated'
  | 'confident'
  | 'overwhelmed'
  | 'bored'
  | 'neutral';

// States that should override back to neutral after 2 hours of inactivity
// (so a student who was overwhelmed yesterday isn't treated that way today)
const TRANSIENT_STATES = new Set<EmotionalState>([
  'stressed', 'overwhelmed', 'frustrated', 'anxious', 'burnt_out'
]);

// Quick keyword pre-screen — avoids an LLM call for clearly neutral messages
// like "explain photosynthesis" or "give me 10 questions"
const NEUTRAL_PATTERNS = [
  /^explain\b/i,
  /^what is\b/i,
  /^how does\b/i,
  /^solve\b/i,
  /^give me\b/i,
  /^make\b/i,
  /^create\b/i,
  /^test me\b/i,
  /^quiz me\b/i,
];

function isLikelyNeutral(message: string): boolean {
  const trimmed = message.trim();
  return NEUTRAL_PATTERNS.some(p => p.test(trimmed));
}

export async function inferAndUpdateEmotionalState(
  userId: string,
  message: string
): Promise<void> {
  try {
    // Skip inference for obviously academic/neutral messages — saves latency + cost
    if (isLikelyNeutral(message) || message.length < 8) return;

    const supabase = await createClient();

    // Fetch current state so we don't downgrade a 'focused' student on one neutral message
    const { data: profile } = await supabase
      .from('profiles')
      .select('emotional_state, last_active_at')
      .eq('id', userId)
      .single();

    const currentState: EmotionalState = (profile?.emotional_state || 'neutral') as EmotionalState;

    // If current state is transient and last_active_at is > 2 hours ago, reset to neutral
    if (TRANSIENT_STATES.has(currentState) && profile?.last_active_at) {
      const lastActive = new Date(profile.last_active_at).getTime();
      const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
      if (lastActive < twoHoursAgo) {
        await supabase
          .from('profiles')
          .update({ emotional_state: 'neutral' })
          .eq('id', userId);
        return;
      }
    }

    const prompt = `Classify the emotional/cognitive state of a student from their message.

Message: "${message.slice(0, 300)}"

Choose EXACTLY one state from this list:
- focused       (in flow, sharp, making progress)
- motivated     (energetic, positive, eager)
- confident     (self-assured, ready to be tested)
- neutral       (calm, just studying, no strong signal)
- bored         (disengaged, going through motions)
- frustrated    (stuck, repeated failure, giving up phrasing)
- stressed      (time pressure, pressure language, panic)
- anxious       (worried about outcome, self-doubt about capability)
- overwhelmed   (too much, can't cope, shutdown signals)
- burnt_out     (exhausted, no motivation left, done)

Rules:
- If the message is purely academic (asking to explain something, solve a problem) → neutral
- Only flag negative states if the message CLEARLY signals them
- Return ONLY the one-word state. Nothing else.`;

    const raw = await routeTextGeneration('json', 'You are an emotional state classifier. Return one word only.', prompt, 0.1, 10);
    const detected = raw.trim().toLowerCase() as EmotionalState;

    const validStates: EmotionalState[] = [
      'focused', 'motivated', 'stressed', 'burnt_out', 'anxious',
      'frustrated', 'confident', 'overwhelmed', 'bored', 'neutral'
    ];

    if (!validStates.includes(detected)) return; // Bad output — do nothing

    // Don't downgrade positive states on a single neutral message
    const positiveStates = new Set<EmotionalState>(['focused', 'motivated', 'confident']);
    if (positiveStates.has(currentState) && detected === 'neutral') return;

    // Only write if state actually changed
    if (detected === currentState) return;

    await supabase
      .from('profiles')
      .update({ emotional_state: detected })
      .eq('id', userId);

    logger.info('Emotional state updated', { userId, from: currentState, to: detected });
  } catch (err) {
    // Completely non-fatal — never let this crash the chat
    logger.warn('inferAndUpdateEmotionalState failed silently', err);
  }
}
