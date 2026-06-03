import { NextResponse } from 'next/server';
// budget-exempt: Uses cost-guard manually
import { createClient } from '@/lib/supabase/server';
import { generateText } from '@/lib/ai/provider-client';
import { reserveBudgetForModelCall, budgetExceededResponse, budgetUnavailableResponse, isBudgetExceeded, isBudgetUnavailable } from '@/lib/ai/cost-guard';

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await (await supabase).auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { data } = body;

    let reservation;
    try {
      reservation = await reserveBudgetForModelCall(user.id, 'analyze', 'quality', 1000, 500);
    } catch (err) {
      if (isBudgetExceeded(err)) return budgetExceededResponse();
      if (isBudgetUnavailable(err)) return budgetUnavailableResponse();
      throw err;
    }

    const analysis = await generateText(
      'flash',
      'You are an elite academic analyst.',
      `Analyze the following student performance data and provide 3 actionable insights.\n\nData: ${JSON.stringify(data)}`,
      0.4,
      reservation.reservationId
    );

    return NextResponse.json({ analysis });
  } catch (error: any) {
    console.error('AI Analyst API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
