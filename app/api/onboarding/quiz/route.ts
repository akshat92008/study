export const maxDuration = 60;
import { createClient } from '@/lib/supabase/server';
import { generateJSON } from '@/lib/ai/gemini';
import { NextResponse } from 'next/server';
import { z } from 'zod';

// Schema for a single question — used to stream one at a time
const SingleQuestionSchema = z.object({
  question: z.string(),
  options: z.array(z.string()).length(4),
  correctIndex: z.number().min(0).max(3),
  chapter: z.string(),
  concept: z.string(),
});

// The 5 topic slots are varied via index so each call targets a different domain
const SLOT_PROMPTS = [
  'the most fundamental theoretical concept',
  'a key formula or quantitative principle',
  'a frequently misunderstood or commonly confused concept',
  'a high-yield application or problem-solving scenario',
  'an integration or synthesis concept that links multiple areas',
];

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { examType } = await req.json();
  if (!examType) return NextResponse.json({ error: 'examType is required' }, { status: 400 });

  const encoder = new TextEncoder();

  // Stream questions one by one as newline-delimited JSON.
  // The frontend parses each line and renders the question immediately —
  // eliminating the 2-minute blocking wait.
  const stream = new ReadableStream({
    async start(controller) {
      for (let i = 0; i < SLOT_PROMPTS.length; i++) {
        const slotDescription = SLOT_PROMPTS[i];
        const prompt = `
          You are an elite academic diagnostic engine.
          The student is preparing for: "${examType}".
          
          Generate exactly ONE multiple-choice question that tests: ${slotDescription}.
          
          RULES:
          1. Baseline calibration difficulty — not impossibly hard.
          2. Identify the specific "chapter" and "concept" being tested.
          3. Provide exactly 4 plausible options with only one correct answer (correctIndex 0–3).
          
          Return STRICT JSON matching the schema. No preamble, no extra text.
        `;

        try {
          const q = await generateJSON(
            'flash',
            'Expert Diagnostic Engine. Return only JSON.',
            prompt,
            SingleQuestionSchema
          );
          // Emit the question as a newline-terminated JSON string
          controller.enqueue(encoder.encode(JSON.stringify(q) + '\n'));
        } catch (err) {
          // Skip failed slots silently — the frontend handles < 5 gracefully
          console.error(`Quiz slot ${i} failed:`, err);
        }
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
