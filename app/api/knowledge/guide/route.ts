import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { GoogleGenAI } from '@google/genai';
import { rateLimit } from '@/lib/utils/rate-limit';
import { safeError, logger } from '@/lib/utils/logger';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // --- NEW RATE LIMIT ---
    // 20 requests per 24 hours
    if (!await rateLimit(`guide-${user.id}`, 20, 24 * 60 * 60 * 1000)) {
      return NextResponse.json({ error: 'Daily study guide generation limit reached.' }, { status: 429 });
    }

    const { materialId } = await req.json();
    if (!materialId) return NextResponse.json({ error: 'materialId required' }, { status: 400 });

    // 1. Fetch material details
    const { data: material } = await supabase.from('materials').select('*').eq('id', materialId).single();
    if (!material) return NextResponse.json({ error: 'Material not found' }, { status: 404 });

    // 2. Fetch all text chunks for this material
    const { data: chunks } = await supabase.from('memory_chunks').select('chunk_text').eq('material_id', materialId);
    if (!chunks || chunks.length === 0) return NextResponse.json({ error: 'No content found for this material' }, { status: 400 });

    const fullText = chunks.map(c => c.chunk_text).join('\n\n');

    // 3. Generate Study Guide via Gemini
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    const prompt = `You are an expert curriculum designer. Given the following raw study material, generate a highly structured, comprehensive, and beautiful Markdown Study Guide.

Include:
- A high-level Executive Summary
- Key Concepts (with definitions)
- Hierarchical breakdown of topics
- 3-5 Practice Questions to test understanding
- Use NotebookLM style formatting.

Material Title: ${material.title}
Content:
${fullText.substring(0, 30000)}
`;

    const res = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const guideMarkdown = res.text || 'Failed to generate guide.';

    return NextResponse.json({ guide: guideMarkdown });
  } catch (error: any) {
    logger.error('Study guide generation failed', error);
    return NextResponse.json(safeError(error), { status: 500 });
  }
}
