import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { GoogleGenAI } from '@google/genai';

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await (await supabase).auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { data } = body;

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are an elite academic analyst. Analyze the following student performance data and provide 3 actionable insights.\n\nData: ${JSON.stringify(data)}`,
    });

    return NextResponse.json({ analysis: response.text });
  } catch (error: any) {
    console.error('AI Analyst API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
