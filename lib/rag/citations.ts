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
