import Tesseract from 'tesseract.js';
import { logger } from '@/lib/utils/logger';

export async function runOCR(imageBase64: string, mimeType: string): Promise<string> {
  try {
    const dataUrl = `data:${mimeType};base64,${imageBase64}`;
    const result = await Tesseract.recognize(dataUrl, 'eng', {
      logger: (m: any) => logger.info('Tesseract OCR progress', m)
    });
    return result.data.text;
  } catch (err) {
    logger.error('Tesseract OCR failed', err);
    return '';
  }
}
