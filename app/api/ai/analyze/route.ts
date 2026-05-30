import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateText } from '@/lib/ai/provider-client';

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await (await supabase).auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { data } = body;

    const analysis = await generateText(
      'flash',
      'You are an elite academic analyst.',
      `Analyze the following student performance data and provide 3 actionable insights.\n\nData: ${JSON.stringify(data)}`,
      0.4
    );

    return NextResponse.json({ analysis });
  } catch (error: any) {
    console.error('AI Analyst API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
