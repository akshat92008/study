import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateText, synthesizeSpeech } from '@/lib/ai/provider-client';
import { safeError, logger } from '@/lib/utils/logger';
import { withRateLimit } from '@/lib/middleware/withRateLimit';
import { reserveBudgetForModelCall, budgetExceededResponse, budgetUnavailableResponse, isBudgetExceeded, isBudgetUnavailable } from '@/lib/ai/cost-guard';

async function generatePodcastScript(
  userId: string,
  materialTitle: string,
  content: string
): Promise<string> {
  const reservation = await reserveBudgetForModelCall(userId, 'knowledge-audio', 'quality', 2000, 1000);

  const text = await generateText(
    'flash',
    'You are writing a podcast script for two hosts.',
    `You are writing a podcast script for two hosts: ALEX (conceptual explainer, calm and precise) and PRIYA (curious questioner, asks what a confused student would ask).

They are discussing study material for a competitive exam student. The tone is conversational, engaging, and educational. This is for a student listening while commuting.

Rules:
- Minimum 10 exchanges between ALEX and PRIYA
- PRIYA asks questions a genuinely confused student would ask — not softballs
- ALEX explains with analogies, connects ideas to exam context, gives memorable examples
- At exchange 7-8, PRIYA summarises her understanding and ALEX corrects any remaining error
- Final exchange: PRIYA states the 3 most important things to remember for the exam
- Each line starts with EXACTLY "ALEX:" or "PRIYA:" — nothing else before the name
- Do not include stage directions, sound effects, or any other text
- Total script: 500-700 words

Material Title: ${materialTitle}

Content to discuss:
${content.slice(0, 18000)}

Output only the script. Start immediately with ALEX: or PRIYA:`,
    0.6,
    reservation.reservationId
  );

  if (!text?.trim()) throw new Error('Empty podcast script from provider router');
  return text.trim();
}

export const POST = withRateLimit('knowledge', async (req, userId) => {
  try {
    const supabase = await createClient();

    const body = await req.json();
    const { materialId } = body;
    if (!materialId) {
      return NextResponse.json({ error: 'materialId is required' }, { status: 400 });
    }

    // Fetch material — RLS guarantees this is the user's own
    const { data: material, error: matErr } = await supabase
      .from('materials')
      .select('id, title')
      .eq('id', materialId)
      .eq('user_id', userId)
      .single();

    if (matErr || !material) {
      return NextResponse.json({ error: 'Material not found' }, { status: 404 });
    }

    // Fetch content chunks
    const { data: chunks, error: chunkErr } = await supabase
      .from('material_chunks')
      .select('chunk_text')
      .eq('material_id', materialId)
      .eq('user_id', userId)
      .order('id', { ascending: true })
      .limit(25);

    if (chunkErr || !chunks || chunks.length === 0) {
      return NextResponse.json(
        { error: 'No content found for this material. Please re-upload.' },
        { status: 400 }
      );
    }

    const content = chunks.map(c => c.chunk_text).join('\n\n');

    // Generate podcast script
    let script;
    try {
      script = await generatePodcastScript(userId, material.title, content);
    } catch (err) {
      if (isBudgetExceeded(err)) return budgetExceededResponse();
      if (isBudgetUnavailable(err)) return budgetUnavailableResponse();
      throw err;
    }

    // Attempt real TTS — returns null if GOOGLE_TTS_API_KEY not set
    const audioDataUrl = await synthesizeSpeech(script);

    return NextResponse.json({
      success: true,
      script,
      audioDataUrl,          // null triggers Web Speech API fallback on client
      hasRealAudio: !!audioDataUrl,
      materialTitle: material.title,
    });

  } catch (error: any) {
    logger.error('Audio generation failed', error);
    return NextResponse.json(safeError(error), { status: 500 });
  }
});
