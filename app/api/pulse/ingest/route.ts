import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });

    const { signals } = await req.json();
    if (!Array.isArray(signals) || signals.length === 0) {
      return NextResponse.json({ ok: true, processed: 0 });
    }

    // Compute aggregated metrics from raw signals
    const keystrokeGaps = signals
      .filter(s => s.type === 'keystroke_pattern')
      .map(s => s.value);

    const messageLengths = signals
      .filter(s => s.type === 'message_length')
      .map(s => s.value);

    if (keystrokeGaps.length === 0 && messageLengths.length === 0) {
      return NextResponse.json({ ok: true, processed: 0 });
    }

    // Compute cognitive load indicators
    const avgKeystrokeGap = keystrokeGaps.length > 0
      ? keystrokeGaps.reduce((a, b) => a + b, 0) / keystrokeGaps.length
      : null;

    const keystrokeVariance = keystrokeGaps.length > 1
      ? computeVariance(keystrokeGaps)
      : null;

    const avgMessageLength = messageLengths.length > 0
      ? messageLengths.reduce((a, b) => a + b, 0) / messageLengths.length
      : null;

    // Infer emotional state from signals
    // High variance in keystrokes = scattered attention
    // Short messages = low engagement or frustration
    // Very long gaps between keystrokes = confused or distracted
    let inferredState = 'neutral';
    let emotionalState = 'neutral';
    
    if (avgKeystrokeGap && avgKeystrokeGap > 3000) {
      inferredState = 'struggling'; // Taking very long to type
      emotionalState = 'frustrated';
    } else if (keystrokeVariance && keystrokeVariance > 500000) {
      inferredState = 'scattered'; // Very inconsistent typing
      emotionalState = 'overwhelmed';
    } else if (avgMessageLength && avgMessageLength < 15) {
      inferredState = 'disengaged'; // Very short responses
      emotionalState = 'bored';
    } else if (avgKeystrokeGap && avgKeystrokeGap < 200 && avgMessageLength && avgMessageLength > 80) {
      inferredState = 'focused'; // Fast typing, long messages
      emotionalState = 'focused';
    }

    // Store pulse signal
    try {
      await supabase.from('pulse_signals').insert({
        user_id: user.id,
        signal_type: 'keystroke_pattern',
        emotional_state: emotionalState,
        confidence: 0.8,
        notes: JSON.stringify({
          avgKeystrokeGap,
          keystrokeVariance,
          avgMessageLength,
          inferredState
        }),
        created_at: new Date().toISOString(),
      });
    } catch (e) {
      logger.warn('Failed to store pulse signal', e);
    }

    // Update profile emotional state if significantly different from current
    if (['struggling', 'scattered'].includes(inferredState)) {
      try {
        await supabase.from('profiles')
          .update({
            emotional_state: inferredState,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id);
      } catch (e) {
        logger.warn('Failed to update emotional state', e);
      }
    } else if (inferredState === 'focused') {
      try {
        await supabase.from('profiles')
          .update({
            emotional_state: 'focused',
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id);
      } catch (e) {
        logger.warn('Failed to update emotional state to focused', e);
      }
    }

    return NextResponse.json({ ok: true, processed: signals.length, state: inferredState });
  } catch (err: any) {
    logger.error('PULSE ingest failed', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

function computeVariance(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
}
