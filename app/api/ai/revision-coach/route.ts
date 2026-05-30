import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateText } from '@/lib/ai/provider-client';
import { validateRequest } from "@/lib/api/validation";
import { z } from "zod";
import { reserveBudgetForModelCall, budgetExceededResponse, budgetUnavailableResponse, isBudgetExceeded, isBudgetUnavailable } from '@/lib/ai/cost-guard';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const schema = z.object({
      currentCard: z.any(),
      performance: z.any(),
    });
    const { currentCard, performance } = await validateRequest(schema, request);

    let reservation;
    try {
      reservation = await reserveBudgetForModelCall(user.id, 'revision-coach', 'flash', 200, 200);
    } catch (err) {
      if (isBudgetExceeded(err)) return budgetExceededResponse();
      if (isBudgetUnavailable(err)) return budgetUnavailableResponse();
      throw err;
    }

    const coaching = await generateText(
      'flash',
      'You are a strict but encouraging academic revision coach.',
      `The student is struggling with the following flashcard:\n\nCard: ${JSON.stringify(currentCard)}\n\nRecent performance: ${JSON.stringify(performance)}\n\nProvide a 2-sentence motivational strategy to help them lock this concept into their long-term memory.`,
      0.5,
      reservation.reservationId
    );

    return NextResponse.json({ coaching });
  } catch (error: any) {
    console.error('AI Revision Coach API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
