import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { GoogleGenAI } from '@google/genai';
import { validateRequest } from "@/lib/api/validation";
import { z } from "zod";
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

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
     const response = await ai.models.generateContent({
       model: 'gemini-2.0-flash',
       contents: `You are a strict but encouraging academic revision coach. The student is struggling with the following flashcard:\n\nCard: ${JSON.stringify(currentCard)}\n\nRecent performance: ${JSON.stringify(performance)}\n\nProvide a 2-sentence motivational strategy to help them lock this concept into their long-term memory.`,
    });

    return NextResponse.json({ coaching: response.text });
  } catch (error: any) {
    console.error('AI Revision Coach API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
