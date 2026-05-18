import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { detectStudyFriction, getAdaptiveConfig, logPulseSignal, CognitiveState } from '@/lib/engines/pulse-engine';
import { logger, safeError } from '@/lib/utils/logger';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { state, confidence } = await detectStudyFriction(user.id);
    const config = getAdaptiveConfig(state);

    return NextResponse.json({ state, confidence, config });
  } catch (error: any) {
    return NextResponse.json(safeError(error), { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { cognitiveState, emotionalState } = body;
    const activeState = cognitiveState || emotionalState;

    // Strict validation against clinical terms
    if (!['focused', 'neutral', 'frustrated', 'overwhelmed'].includes(activeState)) {
      return NextResponse.json({ error: 'Invalid telemetry state' }, { status: 400 });
    }

    const result = await logPulseSignal(user.id, activeState as CognitiveState);

    logger.info('Manual PULSE check-in logged', { userId: user.id, state: activeState });
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(safeError(error), { status: 500 });
  }
}
