import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';

interface PulseSignal {
  type: 'keystroke_pattern' | 'response_time' | 'session_drop' | 'message_length';
  value: number;
  timestamp: number;
}

// Friction scoring weights — same logic as the pulse-engine but computed here
// so we don't need a server import from the client hook.
function computeFrictionScore(signals: PulseSignal[]): number {
  if (signals.length === 0) return 0;

  const keystrokeSignals = signals.filter(s => s.type === 'keystroke_pattern');
  const responseTimes = signals.filter(s => s.type === 'response_time');
  const messageLengths = signals.filter(s => s.type === 'message_length');

  let score = 0;

  // Long inter-keystroke gaps (>3s) indicate hesitation / cognitive overload
  if (keystrokeSignals.length > 0) {
    const avgGap = keystrokeSignals.reduce((a, s) => a + s.value, 0) / keystrokeSignals.length;
    if (avgGap > 5000) score += 3;
    else if (avgGap > 3000) score += 1.5;
  }

  // Very short messages indicate disengagement
  if (messageLengths.length > 0) {
    const avgLen = messageLengths.reduce((a, s) => a + s.value, 0) / messageLengths.length;
    if (avgLen < 10) score += 2;
    else if (avgLen < 25) score += 1;
  }

  // Very fast response times (< 2s) on complex questions indicate guessing
  if (responseTimes.length > 0) {
    const avgResponse = responseTimes.reduce((a, s) => a + s.value, 0) / responseTimes.length;
    if (avgResponse < 2000) score += 1;
  }

  return Math.min(10, score);
}

function scoreToEmotionalState(score: number, currentState: string): string {
  if (score >= 7) return 'overwhelmed';
  if (score >= 4.5) return 'frustrated';
  if (score <= 1 && currentState !== 'overwhelmed') return 'focused';
  return 'neutral';
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });

    const body = await req.json();
    const signals: PulseSignal[] = body.signals || [];

    if (signals.length === 0) {
      return NextResponse.json({ ok: true, processed: 0 });
    }

    const frictionScore = computeFrictionScore(signals);

    // Fetch current emotional state to avoid unnecessary writes
    const { data: profile } = await supabase
      .from('profiles')
      .select('emotional_state')
      .eq('id', user.id)
      .single();

    const currentState = profile?.emotional_state || 'neutral';
    const newState = scoreToEmotionalState(frictionScore, currentState);

    // Only write pulse_signals and update profile if state actually changed
    // or score is high enough to matter. Avoids hammering the DB.
    const stateChanged = newState !== currentState;
    const highFriction = frictionScore >= 4;

    if (stateChanged || highFriction) {
      await supabase.from('pulse_signals').insert({
        user_id: user.id,
        emotional_state: newState,
        friction_score: frictionScore,
        signal_data: signals,
        detected_at: new Date().toISOString(),
      });

      if (stateChanged) {
        await supabase
          .from('profiles')
          .update({
            emotional_state: newState,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id);

        logger.info('PULSE state transition', {
          userId: user.id,
          from: currentState,
          to: newState,
          frictionScore,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      processed: signals.length,
      frictionScore,
      detectedState: newState,
      stateChanged,
    });

  } catch (err) {
    logger.error('Pulse ingest failed', err);
    // Always return 200 — pulse failures must never interrupt a study session
    return NextResponse.json({ ok: false, error: 'internal' }, { status: 200 });
  }
}
