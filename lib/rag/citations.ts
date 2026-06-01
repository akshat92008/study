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
