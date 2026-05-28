import { logger } from '@/lib/utils/logger';

export async function runOCR(imageBase64: string, mimeType: string): Promise<string> {
  if (!imageBase64 || !mimeType) {
    logger.warn('runOCR: Missing image data or mimeType');
    return '';
  }
  try {
    logger.warn('Tesseract OCR is disabled in this environment to prevent worker crashes. Please configure a cloud Vision API (e.g. Google/OpenAI).');
    return '';
  } catch (err) {
    logger.error('Tesseract OCR failed', err);
    return '';
  }
}
