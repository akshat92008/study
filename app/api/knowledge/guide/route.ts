import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { GoogleGenAI } from '@google/genai';
import { safeError, logger } from '@/lib/utils/logger';
import { RateLimiter } from '@/lib/services/rateLimiter';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Rate limit: 20 per 24h
    const limiter = RateLimiter.getInstance();
    const allowed = await limiter.consume(`knowledge-guide-${user.id}`, 20, 24 * 60 * 60 * 1000);
    if (!allowed) return NextResponse.json({ error: 'Daily limit reached.' }, { status: 429 });

    const { materialId } = await req.json();
    if (!materialId) return NextResponse.json({ error: 'materialId required' }, { status: 400 });

    const { data: material } = await supabase
      .from('materials')
      .select('*')
      .eq('id', materialId)
      .eq('user_id', user.id) // RLS double-check
      .single();

    if (!material) return NextResponse.json({ error: 'Material not found' }, { status: 404 });

    // FIX: was 'memory_chunks' — correct table is 'material_chunks'
    const { data: chunks } = await supabase
      .from('material_chunks')
      .select('chunk_text')
      .eq('material_id', materialId)
      .eq('user_id', user.id)
      .order('id', { ascending: true })
      .limit(40); // cap to avoid token overflow

    if (!chunks || chunks.length === 0) {
      return NextResponse.json({ error: 'No content found for this material. Please re-upload.' }, { status: 400 });
    }

    const fullText = chunks.map(c => c.chunk_text).join('\n\n');
    const truncatedText = fullText.slice(0, 80000); // ~20k tokens safety cap

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    const model = ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: `You are an expert curriculum designer for competitive exam preparation. 
Given the following raw study material, generate a highly structured, comprehensive Markdown Study Guide.

Include:
- A high-level Executive Summary (3-5 sentences)
- Key Concepts with clear definitions
- Hierarchical topic breakdown with explanations
- Common exam traps and misconceptions for each major concept
- 5-7 Practice Questions (MCQ format where possible) with answers
- Quick Revision Sheet (bullet-point summary)

Material Title: ${material.title}

Material Content:
${truncatedText}

Output only valid Markdown. No preamble.`,
    });

    const result = await model;
    const guideText = result.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!guideText) {
      return NextResponse.json({ error: 'Guide generation failed. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, guide: guideText, materialTitle: material.title });
  } catch (error: any) {
    logger.error('Study guide generation failed', error);
    return NextResponse.json(safeError(error), { status: 500 });
  }
}
