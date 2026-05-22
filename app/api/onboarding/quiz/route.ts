import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateJSON } from '@/lib/ai/gemini';
import { z } from 'zod';

const QuizSchema = z.object({
  questions: z.array(z.object({
    question: z.string(),
    options: z.array(z.string()).length(4),
    correctIndex: z.number().min(0).max(3),
    chapter: z.string(),
    concept: z.string(),
  })).length(5)
});

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { examType } = await req.json();

    const prompt = `
      You are an elite academic diagnostic engine.
      The student is preparing for: "${examType}".
      Generate exactly 5 multiple-choice questions covering the fundamental, high-yield foundational concepts of this exam/subject.
      
      RULES:
      1. These should not be impossibly hard. They are baseline calibrations.
      2. Identify the specific "chapter" and "concept" each question tests.
      3. Provide 4 plausible options, with only one correct answer.
      
      Return STRICT JSON matching the schema.
    `;

    const quiz = await generateJSON('flash', 'Expert Diagnostic Engine', prompt, QuizSchema);
    return NextResponse.json(quiz);
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to generate diagnostic quiz' }, { status: 500 });
  }
}
