import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { GoogleGenAI } from '@google/genai';
import { safeError, logger } from '@/lib/utils/logger';
import { RateLimiter } from '@/lib/services/rateLimiter';

async function generatePodcastScript(
  materialTitle: string,
  content: string
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

  const result = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: `You are writing a podcast script for two hosts: ALEX (conceptual explainer, calm and precise) and PRIYA (curious questioner, asks what a confused student would ask).

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
  });

  const text = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
  if (!text) throw new Error('Empty script from Gemini');
  return text;
}

async function synthesizeWithGoogleTTS(script: string): Promise<string | null> {
  if (!process.env.GOOGLE_TTS_API_KEY) return null;

  try {
    // Strip speaker names and flatten to plain speech for TTS
    const plainText = script
      .split('\n')
      .filter(l => l.trim().startsWith('ALEX:') || l.trim().startsWith('PRIYA:'))
      .map(l => l.replace(/^(ALEX:|PRIYA:)\s*/, '').trim())
      .join(' ... '); // short pause between speakers

    const response = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${process.env.GOOGLE_TTS_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { text: plainText },
          voice: {
            languageCode: 'en-IN',
            name: 'en-IN-Neural2-A',
            ssmlGender: 'NEUTRAL',
          },
          audioConfig: {
            audioEncoding: 'MP3',
            speakingRate: 1.05,
            pitch: 0,
          },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      logger.warn('Google TTS failed', { status: response.status, err });
      return null;
    }

    const data = await response.json();
    if (!data.audioContent) return null;

    return `data:audio/mp3;base64,${data.audioContent}`;
  } catch (err: any) {
    logger.warn('Google TTS exception', { err: err.message });
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Rate limit: 20 per 24h
    const limiter = RateLimiter.getInstance();
    const allowed = await limiter.consume(`knowledge-audio-${user.id}`, 20, 24 * 60 * 60 * 1000);
    if (!allowed) return NextResponse.json({ error: 'Daily limit reached.' }, { status: 429 });

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
      .eq('user_id', user.id)
      .single();

    if (matErr || !material) {
      return NextResponse.json({ error: 'Material not found' }, { status: 404 });
    }

    // Fetch content chunks
    const { data: chunks, error: chunkErr } = await supabase
      .from('material_chunks')
      .select('chunk_text')
      .eq('material_id', materialId)
      .eq('user_id', user.id)
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
    const script = await generatePodcastScript(material.title, content);

    // Attempt real TTS — returns null if GOOGLE_TTS_API_KEY not set
    const audioDataUrl = await synthesizeWithGoogleTTS(script);

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
}
