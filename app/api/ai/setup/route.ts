import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateJSON } from '@/lib/ai/gemini';
import { z } from 'zod';

// We ask Gemini to turn their conversational chat into structured data
const SetupSchema = z.object({
  reply: z.string(),
  isComplete: z.boolean(),
  extractedData: z.object({
    examType: z.string().nullable(),
    targetYear: z.number().nullable(),
    weakSubjects: z.array(z.string()).nullable(),
  })
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { message, history } = await req.json();

  const prompt = `
    You are the central intelligence of Cognition OS. A new student just logged in.
    Your goal is to have a natural, conversational chat to figure out:
    1. What exam/topic they are studying for.
    2. When they plan to take it (Year).
    3. What specific subjects or chapters they struggle with.

    Chat History:
    ${JSON.stringify(history)}
    Student: "${message}"

    RULES:
    - Be warm, highly intelligent, and brief.
    - If you don't have all 3 pieces of information yet, ask a natural follow-up question, set "isComplete" to false, and leave missing data null.
    - If you DO have enough info to build their curriculum, set "isComplete" to true, output the extracted data, and say something like: "Got it. I'm building your neural map and daily mission now. Stand by."
  `;

  try {
    const result = await generateJSON('pro', 'You are an elite academic setup assistant.', prompt, SetupSchema);

    // If the AI gathered enough info, trigger the massive backend setup!
    if (result.isComplete && result.extractedData.examType) {
      const { completeOnboarding } = await import('@/lib/actions/onboarding');
      
      const targetYear = result.extractedData.targetYear || new Date().getFullYear();
      const targetDate = `${targetYear}-05-01`;

      await completeOnboarding(
        user.id, 
        result.extractedData.examType, 
        targetDate,
        []
      );
    }

    return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });

  } catch (err: any) {
    const fs = require('fs');
    const path = require('path');
    const errorDetails = {
      message: err.message,
      stack: err.stack,
      details: err.details,
      hint: err.hint,
      timestamp: new Date().toISOString(),
    };
    fs.writeFileSync(path.join(process.cwd(), 'scratch/error.log'), JSON.stringify(errorDetails, null, 2));
    console.error(err);
    return new Response(JSON.stringify({ reply: "I had a glitch processing that. Could you repeat it?", isComplete: false }), { status: 500 });
  }
}
