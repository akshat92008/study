import type { AgentToolDefinition, RetrievedSourceChunk } from '@/lib/agent/types';
import { RetrieveSourceChunksInputSchema, ToolResultSchema } from '@/lib/agent/tools/schemas';
import { retrieveRagContext } from '@/lib/rag/retrieval';

const RETRIEVABLE_STATUSES = ['ready', 'READY', 'retrieval_available', 'RETRIEVAL_AVAILABLE'];

function queryTerms(query: string) {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((term) => term.length >= 4 && !['uploaded', 'source', 'material', 'notes', 'explain', 'using', 'from'].includes(term))
    .slice(0, 8);
}

async function keywordFallback(context: any, input: { query: string; materialIds?: string[]; goalId?: string | null; limit: number }) {
  const terms = queryTerms(input.query);
  let query = context.supabase
    .from('study_material_chunks')
    .select(`
      id,
      material_id,
      content,
      heading,
      page_start,
      page_end,
      study_materials!inner(title, subject, chapter, status)
    `)
    .eq('user_id', context.userId)
    .in('study_materials.status', RETRIEVABLE_STATUSES)
    .limit(Math.max(input.limit * 4, 12));
  if (input.materialIds?.length) query = query.in('material_id', input.materialIds);
  if (input.goalId) query = query.eq('study_materials.goal_id', input.goalId);
  
  // Fix 2: Standardize on content.ilike as canonical. Use text only as secondary or handled by backfill.
  if (terms.length > 0) {
    query = query.or(terms.map((term) => `content.ilike.%${term}%`).join(','));
  }

  const { data, error } = await query;
  if (error || !Array.isArray(data)) return [];
  return data
    .map((row: any) => {
      const material = Array.isArray(row.study_materials) ? row.study_materials[0] : row.study_materials;
      // Fix 2: Standardize on content. Legacy handled by migration.
      const content = row.content || '';
      const lower = content.toLowerCase();
      const hits = terms.length ? terms.filter((term) => lower.includes(term)).length : 1;
      return {
        id: row.id,
        materialId: row.material_id,
        title: material?.title ?? 'Uploaded material',
        text: content,
        score: terms.length ? hits / terms.length : 0.2,
        method: 'keyword' as const,
        subject: material?.subject ?? null,
        chapter: material?.chapter ?? null,
        heading: row.heading ?? null,
        pageStart: row.page_start ?? null,
        pageEnd: row.page_end ?? null,
      };
    })
    .sort((a: RetrievedSourceChunk, b: RetrievedSourceChunk) => b.score - a.score)
    .slice(0, input.limit);
}


export const retrieveSourceChunksTool: AgentToolDefinition<typeof RetrieveSourceChunksInputSchema, typeof ToolResultSchema> = {
  name: 'retrieve_source_chunks',
  description: 'Retrieve verified chunks from study_materials/study_material_chunks using vector retrieval with keyword fallback.',
  inputSchema: RetrieveSourceChunksInputSchema,
  outputSchema: ToolResultSchema,
  mutating: false,
  idempotent: true,
  maxCallsPerTurn: 2,
  requiresAuth: true,
  async handler(input, context) {
    const warnings: string[] = [];
    const goalId = input.goalId ?? context.goalId ?? null;
    let chunks: RetrievedSourceChunk[] = [];

    try {
      const rag = await retrieveRagContext({
        userId: context.userId,
        query: input.query,
        mode: 'explicit',
        topK: input.limit,
        materialIds: input.materialIds,
        goalId,
        chatSessionId: context.sessionId ?? undefined,
      });
      warnings.push(...(rag.warnings ?? []));
      chunks = rag.chunks.map((chunk: any) => ({
        id: chunk.id,
        materialId: chunk.materialId,
        title: chunk.materialTitle,
        text: chunk.text,
        score: Number(chunk.score ?? 0),
        method: Number(chunk.score ?? 0) > 0.1 ? 'vector' : 'keyword',
        subject: chunk.subject ?? null,
        chapter: chunk.chapter ?? null,
        heading: chunk.heading ?? null,
        pageStart: chunk.pageStart ?? null,
        pageEnd: chunk.pageEnd ?? null,
      }));
    } catch (error) {
      warnings.push(`vector retrieval unavailable: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (chunks.length === 0) {
      chunks = await keywordFallback(context, {
        query: input.query,
        materialIds: input.materialIds,
        goalId,
        limit: input.limit,
      });
    }

    if (chunks.length === 0 && input.force) {
      chunks = await keywordFallback(context, {
        query: '',
        materialIds: input.materialIds,
        goalId,
        limit: input.limit,
      });
      if (chunks.length > 0) warnings.push('No exact source match; returned available source chunks instead.');
    }

    context.sourceChunks = chunks;

    return {
      success: true,
      changed: false,
      entityType: 'study_material_chunk',
      entityIds: chunks.map((chunk) => chunk.id),
      summary: chunks.length > 0
        ? `Retrieved ${chunks.length} source chunk${chunks.length === 1 ? '' : 's'} from ${new Set(chunks.map((chunk) => chunk.materialId)).size} material${new Set(chunks.map((chunk) => chunk.materialId)).size === 1 ? '' : 's'}.`
        : 'No verified source chunks retrieved.',
      data: {
        chunks,
        chunkIds: chunks.map((chunk) => chunk.id),
        materialIds: Array.from(new Set(chunks.map((chunk) => chunk.materialId))),
        warnings,
      },
    };
  },
};
