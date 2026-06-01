export type CitationParts = {
  title?: string | null;
  pageStart?: number | null;
  pageEnd?: number | null;
  heading?: string | null;
  chunkIndex?: number | null;
};

export function formatCitation(parts: CitationParts): string {
  const title = parts.title?.trim() || 'Uploaded material';
  const details: string[] = [];
  if (parts.pageStart && parts.pageEnd && parts.pageStart !== parts.pageEnd) {
    details.push(`pp. ${parts.pageStart}-${parts.pageEnd}`);
  } else if (parts.pageStart) {
    details.push(`p. ${parts.pageStart}`);
  }
  if (parts.heading) details.push(parts.heading);
  if (!details.length && parts.chunkIndex !== null && parts.chunkIndex !== undefined) {
    details.push(`chunk ${parts.chunkIndex + 1}`);
  }
  return details.length ? `${title}, ${details.join(', ')}` : title;
}

export function formatRagContextForPrompt(context: import('./types').RagContext): string {
  if (!context || !context.chunks || context.chunks.length === 0) {
    return '';
  }

  const chunkBlocks = context.chunks.map((chunk, index) => {
    const citation = formatCitation({
      title: chunk.materialTitle,
      pageStart: chunk.pageStart,
      pageEnd: chunk.pageEnd,
      heading: chunk.heading,
    });
    return `[Source ${index + 1}: ${citation}]\n${chunk.text}`;
  });

  return `RETRIEVED SOURCE CHUNKS:\n\n${chunkBlocks.join('\n\n')}`;
}

export async function storeMessageCitations(input: {
  supabase: any;
  userId: string;
  messageId: string;
  context: import('./types').RagContext | null | undefined;
}) {
  if (!input.context?.grounded || !input.context.chunks.length) return { inserted: 0 };

  const rows = input.context.chunks.map((chunk) => ({
    user_id: input.userId,
    message_id: input.messageId,
    material_id: chunk.materialId,
    chunk_id: chunk.id,
    source_title: chunk.materialTitle,
    page_number: chunk.pageStart,
    section_title: chunk.heading,
    quote: chunk.text.slice(0, 280),
    relevance_score: chunk.score,
    metadata: {
      mode: input.context?.mode,
      evidenceStrength: input.context?.evidenceStrength,
    },
  }));

  const { error } = await input.supabase
    .from('message_citations')
    .upsert(rows, { onConflict: 'user_id,message_id,chunk_id' });

  if (error) throw error;
  return { inserted: rows.length };
}
