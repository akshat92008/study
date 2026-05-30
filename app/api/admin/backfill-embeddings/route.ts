import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getEmbedding } from '@/lib/ai/provider-client';
import { logger } from '@/lib/utils/logger';
import { after } from 'next/server';

import { validateCronRequest } from '@/lib/middleware/cronAuth';

export async function POST(req: NextRequest) {
  const authError = validateCronRequest(req);
  if (authError) return authError;

  const supabase = await createClient();

  // Find concepts with no embedding
  const { data: concepts, error } = await supabase
    .from('concepts')
    .select('id, subject, chapter')
    .is('embedding', null)
    .limit(40);
    
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  if (!concepts || concepts.length === 0) {
    return NextResponse.json({ message: 'No missing embeddings found' });
  }
  
  // Kick off background job to backfill
  after(async () => {
    logger.info(`Starting background backfill for ${concepts.length} concepts...`);
    let successCount = 0;
    
    for (const concept of concepts) {
      try {
        const textToEmbed = `${concept.subject} ${concept.chapter}`;
        const embedding = await getEmbedding(textToEmbed);
        
        if (embedding && Array.isArray(embedding) && embedding.length > 0 && typeof embedding[0] === 'number') {
          const { error: updateErr } = await supabase
            .from('concepts')
            .update({ embedding: `[${embedding.join(',')}]` })
            .eq('id', concept.id);
             
           if (updateErr) {
             logger.error('Failed to update DB for concept', { conceptId: concept.id, error: updateErr });
           } else {
             successCount++;
           }
        }
      } catch (e) {
        logger.error('Failed to embed concept', { conceptId: concept.id, error: e });
      }
      
      // Delay to avoid Gemini rate limits
      await new Promise(r => setTimeout(r, 200));
    }
    logger.info(`Finished background backfill. Successfully updated ${successCount} concepts.`);
  });
  
  return NextResponse.json({ 
    message: `Background job started to backfill embeddings for ${concepts.length} concepts.`,
    conceptsEnqueued: concepts.length
  });
}
