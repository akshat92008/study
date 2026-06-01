import { sha256Hex } from '@/lib/rag/hash';
import { getRagConfig } from '@/lib/rag/config';

export type ExtractedPage = {
  pageNumber: number;
  text: string;
};

export type RagChunkInput = {
  pages: ExtractedPage[];
  maxChunks?: number;
  chunkSizeChars?: number;
  overlapChars?: number;
};

export type RagChunk = {
  chunkIndex: number;
  text: string;
  pageStart: number | null;
  pageEnd: number | null;
  heading: string | null;
  tokenEstimate: number;
  contentHash: string;
};

export function cleanExtractedText(text: string): string {
  return text
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[^\S\n]+$/gm, '')
    .trim();
}

function inferHeading(text: string): string | null {
  const firstLines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 6);

  const heading = firstLines.find((line) => {
    if (line.length < 4 || line.length > 100) return false;
    if (/^[#\d.\s-]+$/.test(line)) return false;
    const alpha = line.replace(/[^A-Za-z]/g, '');
    if (alpha.length < 3) return false;
    return line === line.toUpperCase() || /^#{1,4}\s+/.test(line) || /^[A-Z][A-Za-z0-9 ,:()/-]+$/.test(line);
  });

  return heading?.replace(/^#{1,4}\s+/, '').trim() || null;
}

export function chunkExtractedPages(input: RagChunkInput): RagChunk[] {
  const config = getRagConfig();
  const chunkSize = input.chunkSizeChars ?? config.chunkSizeChars;
  const overlap = Math.min(input.overlapChars ?? config.chunkOverlapChars, Math.max(0, chunkSize - 200));
  const maxChunks = input.maxChunks ?? config.maxChunksPerFile;
  const chunks: RagChunk[] = [];
  const seen = new Set<string>();

  for (const page of input.pages) {
    const text = cleanExtractedText(page.text);
    if (!text) continue;

    let start = 0;
    while (start < text.length && chunks.length < maxChunks) {
      let end = Math.min(text.length, start + chunkSize);
      if (end < text.length) {
        const paragraphBreak = text.lastIndexOf('\n\n', end);
        const sentenceBreak = text.lastIndexOf('. ', end);
        const softBreak = Math.max(paragraphBreak, sentenceBreak);
        if (softBreak > start + Math.floor(chunkSize * 0.55)) {
          end = softBreak + (softBreak === sentenceBreak ? 1 : 0);
        }
      }

      const rawChunk = cleanExtractedText(text.slice(start, end));
      if (rawChunk.length >= 80) {
        const contentHash = sha256Hex(rawChunk);
        if (!seen.has(contentHash)) {
          seen.add(contentHash);
          chunks.push({
            chunkIndex: chunks.length,
            text: rawChunk,
            pageStart: page.pageNumber || null,
            pageEnd: page.pageNumber || null,
            heading: inferHeading(rawChunk),
            tokenEstimate: Math.ceil(rawChunk.length / 4),
            contentHash,
          });
        }
      }

      if (end >= text.length) break;
      start = Math.max(end - overlap, start + 1);
    }
  }

  return chunks;
}
