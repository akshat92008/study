import pdfParse from 'pdf-parse';
import { cleanExtractedText, type ExtractedPage } from '@/lib/rag/chunker';

export type ExtractedMaterialText = {
  pages: ExtractedPage[];
  pageCount: number | null;
  charCount: number;
  ocrRequired: boolean;
};

export async function extractMaterialText(
  buffer: Buffer,
  mimeType: string
): Promise<ExtractedMaterialText> {
  if (mimeType === 'application/pdf') {
    return extractPdfText(buffer);
  }

  if (mimeType.startsWith('text/') || mimeType === 'application/markdown') {
    const text = cleanExtractedText(buffer.toString('utf8'));
    return {
      pages: text ? [{ pageNumber: 1, text }] : [],
      pageCount: text ? 1 : 0,
      charCount: text.length,
      ocrRequired: false,
    };
  }

  throw new Error(`Unsupported material MIME type: ${mimeType}`);
}

async function extractPdfText(buffer: Buffer): Promise<ExtractedMaterialText> {
  const pages: ExtractedPage[] = [];
  let pageNo = 0;

  const parsed = await pdfParse(buffer, {
    pagerender: async (pageData: any) => {
      pageNo += 1;
      const content = await pageData.getTextContent({
        normalizeWhitespace: true,
        disableCombineTextItems: false,
      });
      const text = cleanExtractedText(
        content.items
          .map((item: any) => item.str)
          .join(' ')
      );
      if (text) pages.push({ pageNumber: pageNo, text });
      return text;
    },
  } as any);

  if (!pages.length && parsed.text?.trim()) {
    pages.push({ pageNumber: 1, text: cleanExtractedText(parsed.text) });
  }

  const charCount = pages.reduce((sum, page) => sum + page.text.length, 0);
  return {
    pages,
    pageCount: parsed.numpages ?? pages.length,
    charCount,
    ocrRequired: charCount < 80,
  };
}
