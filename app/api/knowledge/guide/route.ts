import { NextResponse } from 'next/server';
// budget-exempt: Uses cost-guard manually
import { createClient } from '@/lib/supabase/server';
import { generateText } from '@/lib/ai/provider-client';
import { safeError, logger } from '@/lib/utils/logger';
import { withRateLimit } from '@/lib/middleware/withRateLimit';
import { reserveBudgetForModelCall, budgetExceededResponse, budgetUnavailableResponse, isBudgetExceeded, isBudgetUnavailable } from '@/lib/ai/cost-guard';

export const POST = withRateLimit('knowledge', async (req, userId) => {
  try {
    const supabase = await createClient();

    const { materialId } = await req.json();
    if (!materialId) return NextResponse.json({ error: 'materialId required' }, { status: 400 });

    const { data: material } = await supabase
      .from('study_materials')
      .select('*')
      .eq('id', materialId)
      .eq('user_id', userId) // RLS double-check
      .single();

    if (!material) return NextResponse.json({ error: 'Material not found' }, { status: 404 });

    const { data: chunks } = await supabase
      .from('study_material_chunks')
      .select('text')
      .eq('material_id', materialId)
      .eq('user_id', userId)
      .order('chunk_index', { ascending: true })
      .limit(40); // cap to avoid token overflow

    if (!chunks || chunks.length === 0) {
      return NextResponse.json({ error: 'No content found for this material. Please re-upload.' }, { status: 400 });
    }

    const fullText = chunks.map(c => c.text).join('\n\n');
    const truncatedText = fullText.slice(0, 80000); // ~20k tokens safety cap


    let reservation;
    try {
      reservation = await reserveBudgetForModelCall(userId, 'knowledge-guide', 'quality', 15000, 3000);
    } catch (err) {
      if (isBudgetExceeded(err)) return budgetExceededResponse();
      if (isBudgetUnavailable(err)) return budgetUnavailableResponse();
      throw err;
    }

    const guideText = await generateText(
      'pro',
      'You are an expert curriculum designer for competitive exam preparation.',
      `Given the following raw study material, generate a highly structured, comprehensive Markdown Study Guide.

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
      0.4,
      reservation.reservationId
    );

    if (!guideText) {
      return NextResponse.json({ error: 'Guide generation failed. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, guide: guideText, materialTitle: material.title });
  } catch (error: any) {
    logger.error('Study guide generation failed', error);
    return NextResponse.json(safeError(error), { status: 500 });
  }
});
