import { createAdminClient } from '@/lib/supabase/admin';
import { getRagConfig } from './config';
import { embedRagText } from './embedding';
import type { RagChunk, RagContext, RagMode, RagRetrieveInput } from './types';
import { getAiCostMode } from '@/lib/ai/cost-mode';
import { getTokenBudget, type AiTask } from '@/lib/ai/token-budget';
import { selectRagContext } from './token-aware-context';

const EXPLICIT_RAG_RE =
  /\b(from|according to|based on|use|using|in)\s+(my\s+)?(notes|material|pdf|document|source|ncert|textbook|uploaded|chapter)\b/i;

const STUDY_RE =
  /\b(explain|summarize|summary|flashcards?|mcqs?|questions?|notes?|study guide|compare|chapter|topic|formula|neet|ncert|according)\b/i;

export function inferRagMode(message: string, hasReadyMaterials: boolean): RagMode {
  if (!hasReadyMaterials) return 'off';
  if (EXPLICIT_RAG_RE.test(message)) return 'explicit';
  if (message.length >= 16 && STUDY_RE.test(message)) return 'implicit';
  return 'off';
}

export async function retrieveRagContext(input: RagRetrieveInput): Promise<RagContext> {
  const supabase = createAdminClient();
  const RAG_CONFIG = getRagConfig();
  const topK = Math.max(1, Math.min(input.topK ?? RAG_CONFIG.topK, RAG_CONFIG.hardMaxTopK));
  const maxContextChars = input.maxContextChars ?? RAG_CONFIG.maxContextChars;
  const mode = input.mode ?? 'implicit';

  if (mode === 'off' || !input.query.trim()) {
    return emptyContext(mode);
  }

  const embedding = await embedRagText(input.query.slice(0, 2000), {
    userId: input.userId,
    route: 'rag-search'
  });
  let chunks: RagChunk[] = [];

  if (embedding && embedding.length > 0) {
    const { data, error } = await supabase.rpc('match_study_material_chunks', {
      query_embedding: `[${embedding.join(',')}]`,
      match_user_id: input.userId,
      match_count: topK,
      material_filter: input.materialIds ?? null,
      subject_filter: input.subject ?? null,
      chapter_filter: input.chapter ?? null,
      similarity_threshold: RAG_CONFIG.minSimilarity,
    });

    if (!error && Array.isArray(data)) {
      chunks = data.map((row: any) => ({
        id: row.id,
        materialId: row.material_id,
        materialTitle: row.material_title ?? 'Uploaded material',
        sourceType: row.source_type ?? null,
        subject: row.subject ?? null,
        chapter: row.chapter ?? null,
        heading: row.heading ?? null,
        pageStart: row.page_start ?? null,
        pageEnd: row.page_end ?? null,
        text: row.text,
        score: Number(row.similarity ?? 0),
      }));
    } else if (error) {
      console.warn('[RAG] vector retrieval failed; falling back to keyword search', error.message);
    }
  }

  if (chunks.length === 0) {
    chunks = await keywordFallback(input, topK);
  }

  const costMode = getAiCostMode();
  // Assume chat task for budget if not specified.
  const task: AiTask = (input as any).task ?? 'chat'; 
  const budget = getTokenBudget(task, costMode);

  chunks = selectRagContext(chunks, budget, costMode);

  const context: RagContext = {
    mode,
    chunks,
    materialIds: Array.from(new Set(chunks.map((c) => c.materialId))),
    chunkIds: chunks.map((c) => c.id),
    totalContextChars: chunks.reduce((sum, chunk) => sum + chunk.text.length, 0),
    grounded: chunks.length > 0,
    evidenceStrength: getEvidenceStrength(chunks),
    warnings: chunks.length === 0 ? ['No relevant uploaded source chunks found.'] : [],
  };

  try {
    await supabase.from('rag_query_logs').insert({
      user_id: input.userId,
      query: input.query.slice(0, 2000),
      material_ids: input.materialIds ?? null,
      retrieved_chunk_ids: chunks.map((chunk) => chunk.id),
      total_chunks: chunks.length,
      total_context_chars: context.totalContextChars,
      grounded: context.grounded,
      mode,
    });
  } catch (err) {
    console.warn('[RAG] Failed to log query', err);
  }

  return context;
}

async function keywordFallback(input: RagRetrieveInput, topK: number): Promise<RagChunk[]> {
  const supabase = createAdminClient();
  const terms = input.query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((term) => term.length >= 4)
    .slice(0, 8);

  if (terms.length === 0) return [];

  let query: any = supabase
    .from('study_material_chunks')
    .select(`
      id,
      material_id,
      user_id,
      chunk_index,
      page_start,
      page_end,
      heading,
      text,
      study_materials!inner(title, source_type, subject, chapter, status)
    `)
    .eq('user_id', input.userId)
    .eq('study_materials.status', 'ready')
    .limit(Math.max(topK * 4, 12));

  if (input.materialIds?.length) {
    query = query.in('material_id', input.materialIds);
  }

  const orFilter = terms.map((term) => `text.ilike.%${term}%`).join(',');
  query = query.or(orFilter);

  const { data, error } = await query;

  if (error || !Array.isArray(data)) {
    if (error) console.warn('[RAG] keyword fallback failed', error.message);
    return [];
  }

  return data
    .map((row: any) => {
      const score = keywordScore(row.text, terms);
      const material = Array.isArray(row.study_materials)
        ? row.study_materials[0]
        : row.study_materials;

      return {
        id: row.id,
        materialId: row.material_id,
        materialTitle: material?.title ?? 'Uploaded material',
        sourceType: material?.source_type ?? null,
        subject: material?.subject ?? null,
        chapter: material?.chapter ?? null,
        heading: row.heading ?? null,
        pageStart: row.page_start ?? null,
        pageEnd: row.page_end ?? null,
        text: row.text,
        score,
      } satisfies RagChunk;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

function keywordScore(text: string, terms: string[]): number {
  const lower = text.toLowerCase();
  const hits = terms.reduce((count, term) => count + (lower.includes(term) ? 1 : 0), 0);
  return hits / Math.max(terms.length, 1);
}



function getEvidenceStrength(chunks: RagChunk[]): 'high' | 'medium' | 'low' | 'none' {
  if (chunks.length === 0) return 'none';
  const best = Math.max(...chunks.map((chunk) => chunk.score));
  if (best >= 0.65 || chunks.length >= 5) return 'high';
  if (best >= 0.35 || chunks.length >= 3) return 'medium';
  return 'low';
}

function emptyContext(mode: RagMode): RagContext {
  return {
    mode,
    chunks: [],
    materialIds: [],
    chunkIds: [],
    totalContextChars: 0,
    grounded: false,
    evidenceStrength: 'none',
    warnings: [],
  };
}
