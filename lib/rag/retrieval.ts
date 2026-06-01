import { SupabaseClient } from '@supabase/supabase-js';
import { formatCitation } from '@/lib/rag/citations';
import { getRagConfig } from '@/lib/rag/config';
import { embedRagText } from '@/lib/rag/embedding';
import { classifyRagMode, mentionsNcert, type RagMode } from '@/lib/rag/intent';
import { logger } from '@/lib/utils/logger';

export type RagRetrievedChunk = {
  id: string;
  materialId: string;
  materialTitle: string;
  sourceType: string | null;
  pageStart: number | null;
  pageEnd: number | null;
  heading: string | null;
  chunkIndex: number;
  text: string;
  score: number;
  citation: string;
};

export type RagContext = {
  mode: RagMode;
  chunks: RagRetrievedChunk[];
  totalContextChars: number;
  grounded: boolean;
  evidenceStrength: 'high' | 'medium' | 'low' | 'none';
  warnings: string[];
  materialIds: string[];
  chunkIds: string[];
};

export type RetrieveRagContextInput = {
  supabase: SupabaseClient;
  userId: string;
  query: string;
  materialIds?: string[];
  subject?: string | null;
  chapter?: string | null;
  mode?: RagMode;
};

export async function retrieveRagContext(input: RetrieveRagContextInput): Promise<RagContext> {
  const config = getRagConfig();
  const mode = input.mode ?? classifyRagMode(input.query);
  const warnings: string[] = [];
  if (mode === 'off') return emptyContext(mode);

  try {
    const embedding = await embedRagText(input.query, {
      userId: input.userId,
      route: 'rag-search',
    });

    let rows: any[] = [];
    if (embedding.length) {
      const { data, error } = await input.supabase.rpc('match_study_material_chunks', {
        query_embedding: `[${embedding.join(',')}]`,
        match_user_id: input.userId,
        match_count: config.topK,
        material_filter: input.materialIds?.length ? input.materialIds : null,
        subject_filter: input.subject ?? null,
        chapter_filter: input.chapter ?? null,
        similarity_threshold: config.minSimilarity,
      });
      if (error) {
        warnings.push('Vector retrieval failed; keyword fallback used.');
        logger.warn('RAG vector retrieval failed', { userId: input.userId, error: error.message });
      } else {
        rows = data || [];
      }
    } else {
      warnings.push('No embedding provider available; keyword fallback used.');
    }

    if (!rows.length) {
      rows = await keywordFallback(input, config.topK);
    }

    const boosted = rerankRows(rows, input.query, mentionsNcert(input.query));
    const capped = capContext(boosted, config.maxContextChars);
    const chunks = capped.map(rowToChunk);
    const evidenceStrength = getEvidenceStrength(chunks);
    const context: RagContext = {
      mode,
      chunks,
      totalContextChars: chunks.reduce((sum, chunk) => sum + chunk.text.length, 0),
      grounded: chunks.length > 0 && evidenceStrength !== 'none',
      evidenceStrength,
      warnings,
      materialIds: Array.from(new Set(chunks.map((chunk) => chunk.materialId))),
      chunkIds: chunks.map((chunk) => chunk.id),
    };

    await input.supabase.from('rag_query_logs').insert({
      user_id: input.userId,
      query: input.query.slice(0, 2000),
      material_ids: context.materialIds,
      retrieved_chunk_ids: context.chunkIds,
      total_chunks: context.chunks.length,
      total_context_chars: context.totalContextChars,
      grounded: context.grounded,
    }).then(() => undefined);

    return context;
  } catch (error) {
    logger.warn('RAG retrieval failed safely', {
      userId: input.userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      ...emptyContext(mode),
      warnings: ['RAG retrieval failed; MIND can answer normally without source grounding.'],
    };
  }
}

function emptyContext(mode: RagMode): RagContext {
  return {
    mode,
    chunks: [],
    totalContextChars: 0,
    grounded: false,
    evidenceStrength: 'none',
    warnings: [],
    materialIds: [],
    chunkIds: [],
  };
}

async function keywordFallback(input: RetrieveRagContextInput, limit: number): Promise<any[]> {
  const terms = tokenize(input.query).slice(0, 8);
  if (!terms.length) return [];

  let query = input.supabase
    .from('study_material_chunks')
    .select(`
      id,
      material_id,
      chunk_index,
      page_start,
      page_end,
      heading,
      text,
      study_materials!inner(id, title, source_type, subject, chapter, status)
    `)
    .eq('user_id', input.userId)
    .eq('study_materials.status', 'ready')
    .limit(120);

  if (input.materialIds?.length) query = query.in('material_id', input.materialIds);
  if (input.subject) query = query.ilike('study_materials.subject', `%${input.subject}%`);
  if (input.chapter) query = query.ilike('study_materials.chapter', `%${input.chapter}%`);

  const { data, error } = await query;
  if (error || !data) return [];

  return data
    .map((row: any) => ({
      ...row,
      similarity: keywordScore(row.text, terms),
    }))
    .filter((row: any) => row.similarity > 0)
    .sort((a: any, b: any) => b.similarity - a.similarity)
    .slice(0, limit);
}

function tokenize(text: string): string[] {
  return Array.from(new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((term) => term.length > 2)
  ));
}

function keywordScore(text: string, terms: string[]): number {
  const haystack = text.toLowerCase();
  const hits = terms.filter((term) => haystack.includes(term)).length;
  return terms.length ? hits / terms.length : 0;
}

function rerankRows(rows: any[], query: string, ncertBoost: boolean): any[] {
  const terms = tokenize(query);
  return rows
    .map((row) => {
      const material = Array.isArray(row.study_materials) ? row.study_materials[0] : row.study_materials;
      const keyword = keywordScore(row.text ?? row.content ?? '', terms);
      const sourceBoost = ncertBoost && material?.source_type === 'ncert' ? 0.08 : 0;
      return {
        ...row,
        study_materials: material,
        score: Math.min(1, Number(row.similarity ?? 0) + keyword * 0.15 + sourceBoost),
      };
    })
    .sort((a, b) => b.score - a.score);
}

function capContext(rows: any[], maxChars: number): any[] {
  const selected: any[] = [];
  let chars = 0;
  const seenMaterials = new Map<string, number>();

  for (const row of rows) {
    const text = row.text ?? row.content ?? '';
    if (!text) continue;
    const materialId = row.material_id;
    const materialCount = seenMaterials.get(materialId) ?? 0;
    if (materialCount >= 3) continue;
    if (chars + text.length > maxChars && selected.length > 0) continue;
    selected.push(row);
    chars += text.length;
    seenMaterials.set(materialId, materialCount + 1);
    if (chars >= maxChars) break;
  }

  return selected;
}

function rowToChunk(row: any): RagRetrievedChunk {
  const material = Array.isArray(row.study_materials) ? row.study_materials[0] : row.study_materials;
  return {
    id: row.id,
    materialId: row.material_id,
    materialTitle: material?.title || row.material_title || 'Uploaded material',
    sourceType: material?.source_type || row.source_type || null,
    pageStart: row.page_start ?? null,
    pageEnd: row.page_end ?? null,
    heading: row.heading ?? null,
    chunkIndex: Number(row.chunk_index ?? 0),
    text: row.text ?? row.content ?? '',
    score: Number(row.score ?? row.similarity ?? 0),
    citation: formatCitation({
      title: material?.title || row.material_title,
      pageStart: row.page_start,
      pageEnd: row.page_end,
      heading: row.heading,
      chunkIndex: Number(row.chunk_index ?? 0),
    }),
  };
}

function getEvidenceStrength(chunks: RagRetrievedChunk[]): RagContext['evidenceStrength'] {
  if (!chunks.length) return 'none';
  const top = chunks[0]?.score ?? 0;
  if (top >= 0.78 || chunks.length >= 3) return 'high';
  if (top >= 0.62 || chunks.length >= 2) return 'medium';
  return 'low';
}
