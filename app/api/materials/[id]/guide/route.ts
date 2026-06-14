import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { budgetedGenerateText } from '@/lib/ai/budgeted';
import { safeError, logger } from '@/lib/utils/logger';
import { budgetExceededResponse, budgetUnavailableResponse, isBudgetExceeded, isBudgetUnavailable } from '@/lib/ai/cost-guard';

async function generateSourceGuide(
  userId: string,
  materialTitle: string,
  content: string
): Promise<any> {
  const text = await budgetedGenerateText({
    userId,
    feature: 'knowledge-guide',
    model: 'flash',
    systemPrompt: 'You are a study guide generator. You must return ONLY a raw JSON object.',
    userPrompt: `You are generating a Source Guide for the following study material.
The guide must contain a summary, 3-5 key concepts, and 3-5 frequently asked questions.

Material Title: ${materialTitle}

Content to analyze:
${content.slice(0, 20000)}

You must return EXACTLY and ONLY a valid JSON object matching this schema:
{
  "summary": "A 2-3 sentence overview of the material.",
  "keyConcepts": [
    { "term": "Concept Name", "definition": "Brief definition or importance" }
  ],
  "faqs": [
    { "question": "A likely question?", "answer": "A concise answer." }
  ]
}

DO NOT include markdown formatting like \`\`\`json. Output ONLY the raw JSON object.`,
    maxOutputTokens: 500
  });

  if (!text?.trim()) throw new Error('Empty guide generated');
  
  try {
    // Attempt to parse JSON. Sometimes LLMs still add markdown.
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanText);
  } catch (err) {
    logger.error('Failed to parse Source Guide JSON', { text });
    throw new Error('Failed to parse generated guide.');
  }
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const materialId = params.id;

    // Fetch material
    const { data: material, error: matErr } = await supabase
      .from('study_materials')
      .select('id, title, source_guide')
      .eq('id', materialId)
      .eq('user_id', user.id)
      .single();

    if (matErr || !material) {
      return NextResponse.json({ error: 'Material not found' }, { status: 404 });
    }

    if (material.source_guide) {
      return NextResponse.json({ success: true, guide: material.source_guide });
    }

    // Generate if not exists
    const { data: chunks, error: chunkErr } = await supabase
      .from('study_material_chunks')
      .select('content')
      .eq('material_id', materialId)
      .eq('user_id', user.id)
      .order('chunk_index', { ascending: true })
      .limit(30);

    if (chunkErr || !chunks || chunks.length === 0) {
      return NextResponse.json(
        { error: 'No content found for this material. Please re-upload.' },
        { status: 400 }
      );
    }

    const content = chunks.map(c => c.content).join('\n\n');

    let guide;
    try {
      guide = await generateSourceGuide(user.id, material.title, content);
    } catch (err) {
      if (isBudgetExceeded(err)) return budgetExceededResponse();
      if (isBudgetUnavailable(err)) return budgetUnavailableResponse();
      throw err;
    }

    // Save back to DB
    const { error: updateErr } = await supabase
      .from('study_materials')
      .update({ source_guide: guide })
      .eq('id', materialId);

    if (updateErr) {
      logger.error('Failed to save source guide', updateErr);
    }

    return NextResponse.json({ success: true, guide });

  } catch (error: any) {
    logger.error('[guide] generation failed', { error: safeError(error) });
    return NextResponse.json({ error: safeError(error) }, { status: 500 });
  }
}
