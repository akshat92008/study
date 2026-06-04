/**
 * scripts/reembed.ts
 * One-time script: re-embed all vectors using text-embedding-004.
 * Run: npx ts-node --project tsconfig.json scripts/reembed.ts
 *
 * DO NOT run this in parallel with production traffic.
 * Run on staging first. Takes ~10-30 min depending on DB size.
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // service role needed for bulk updates
);

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

async function getEmbedding(text: string): Promise<number[] | null> {
  try {
    const res = await ai.models.embedContent({
      model: 'text-embedding-004',
      contents: text,
    });
    return res.embeddings?.[0]?.values ?? null;
  } catch (err) {
    console.error('Embedding failed:', err);
    return null;
  }
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function reembedTable(
  tableName: string,
  contentCol: string,
  idCol: string = 'id'
) {
  console.log(`\n=== Reembedding ${tableName} ===`);
  
  let offset = 0;
  const BATCH = 50;
  let totalUpdated = 0;
  let totalFailed = 0;
  const MAX_ITERATIONS = 10000; // safety cap to avoid endless loops
  let iteration = 0;

  while (true) {
    if (iteration++ >= MAX_ITERATIONS) {
      console.warn(`⚠️ Reembed loop reached max iterations (${MAX_ITERATIONS}). Exiting to avoid infinite run.`);
      break;
    }
    const { data: rows, error } = await supabase
      .from(tableName)
      .select(`${idCol}, ${contentCol}`)
      .not(contentCol, 'is', null)
      .range(offset, offset + BATCH - 1);

    if (error) { console.error(`Query error on ${tableName}:`, error); break; }
    if (!rows || rows.length === 0) break;

     for (const row of rows as any[]) {
       const content = (row as Record<string, unknown>)[contentCol];
      if (!content || typeof content !== 'string' || content.trim().length === 0) {
        continue;
      }

      const embedding = await getEmbedding(content.slice(0, 2000)); // truncate for safety
      
      if (embedding) {
        const { error: updateErr } = await supabase
          .from(tableName)
          .update({ embedding })
          .eq(idCol, row[idCol]);

        if (updateErr) {
          console.error(`Update failed for ${tableName} id=${row[idCol]}:`, updateErr);
          totalFailed++;
        } else {
          totalUpdated++;
        }
      } else {
        totalFailed++;
      }

      await sleep(50); // 50ms between rows — ~20 req/s, well under Gemini limits
    }

    console.log(`  ${tableName}: processed ${offset + rows.length} rows (updated: ${totalUpdated}, failed: ${totalFailed})`);
    offset += BATCH;

    if (rows.length < BATCH) break; // last page
    await sleep(200); // 200ms between batches
  }

  console.log(`  DONE: ${tableName} — ${totalUpdated} updated, ${totalFailed} failed`);
}

async function main() {
  console.log('Cognition OS — Re-embedding script');
  console.log('Model: text-embedding-004 | Target dimension: 768');
  console.log('Started:', new Date().toISOString());

  await reembedTable('chat_memory_embeddings', 'content');
  await reembedTable('material_chunks', 'content');
  await reembedTable('concepts', 'name'); // concepts embed on their name+description

  console.log('\nAll tables reembedded.');
  console.log('Finished:', new Date().toISOString());
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
