import { retrieveRagContext } from '@/lib/rag/retrieval';
import { formatCitation } from '@/lib/rag/citations';

export function chunkText(text: string, chunkSize = 400, overlapSize = 80): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];

  let i = 0;
  while (i < words.length) {
    const chunk = words.slice(i, i + chunkSize).join(' ');
    if (chunk.length > 50) chunks.push(chunk); // filter tiny trailing chunks
    i += chunkSize - overlapSize; // overlap for context continuity
  }

  return chunks;
}

/**
 * @deprecated Use lib/rag/ingest instead. This function relies on deprecated 'materials' tables.
 */
export async function ingestMaterial(userId: string, title: string, content: string) {
  throw new Error("ingestMaterial is deprecated. Use lib/rag/ingest.ts instead.");
}

/**
 * @deprecated Use lib/rag/retrieval instead. This function relies on deprecated 'materials' tables.
 */
export async function searchPersonalKnowledge(userId: string, query: string, threshold = 0.5, limit = 3) {
  throw new Error("searchPersonalKnowledge is deprecated. Use lib/rag/retrieval.ts instead.");
}

export class RAGEngine {
  async retrieve(input: {
    userId: string;
    query: string;
    materialIds?: string[];
    subject?: string | null;
    chapter?: string | null;
  }) {
    return retrieveRagContext({
      userId: input.userId,
      query: input.query,
      materialIds: input.materialIds,
      subject: input.subject || undefined,
      chapter: input.chapter || undefined,
    });
  }

  async search({ userId, query, limit = 4 }: { userId: string, query: string, limit?: number }) {
    const context = await this.retrieve({ userId, query });
    return context.chunks.slice(0, limit).map((chunk, index) => ({
      id: chunk.id,
      materialId: chunk.materialId,
      content: chunk.text,
      similarity: chunk.score,
      sourceTitle: chunk.materialTitle,
      citation: formatCitation({
        title: chunk.materialTitle,
        pageStart: chunk.pageStart,
        pageEnd: chunk.pageEnd,
        heading: chunk.heading,
        chunkIndex: index,
      }),
      pageStart: chunk.pageStart,
      pageEnd: chunk.pageEnd,
      heading: chunk.heading,
    }));
  }
}
