import type { ExtractionResult } from '../types';

export async function extractSelectableTextFromPdf(buffer: Buffer): Promise<ExtractionResult> {
  const warnings: string[] = [];
  try {
    const mod = await import('pdf-parse');
    const pdfParse = (mod as any).default ?? mod;
    const result = await pdfParse(buffer);
    const rawText = String(result.text ?? '').trim();
    const pageCount = Number(result.numpages ?? 0);
    const confidence = confidenceFor(rawText, pageCount);

    if (!rawText) warnings.push('No selectable text was found in this PDF.');
    if (confidence < 0.55) warnings.push('Question parsing confidence is low; manual entry is recommended.');

    return {
      rawText,
      pages: [{ pageNumber: 1, text: rawText }],
      confidence,
      warnings,
    };
  } catch {
    return {
      rawText: '',
      pages: [],
      confidence: 0,
      warnings: ['We could not reliably read this PDF. You can still continue with manual entry.'],
    };
  }
}

function confidenceFor(rawText: string, pageCount: number): number {
  if (!rawText.trim()) return 0;
  let confidence = 0.35;
  if (rawText.length > 500) confidence += 0.25;
  if (/\b(q\.?|question)\s*\d+/i.test(rawText) || /\n\s*\d+[.)]/.test(rawText)) confidence += 0.15;
  if (/\b[A-D][.)]/.test(rawText)) confidence += 0.1;
  if (pageCount > 0) confidence += 0.1;
  return Math.min(0.95, confidence);
}
