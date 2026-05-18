import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { detectEmotionalState, getAdaptiveConfig, logPulseSignal } from '@/lib/engines/pulse-engine';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { state, confidence } = await detectEmotionalState(user.id);
    const config = getAdaptiveConfig(state);

    return NextResponse.json({ state, confidence, config });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { emotionalState, notes } = body;

    if (!emotionalState) {
      return NextResponse.json({ error: 'emotionalState required' }, { status: 400 });
    }

    const result = await logPulseSignal(user.id, 'self_report', emotionalState, { notes });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
