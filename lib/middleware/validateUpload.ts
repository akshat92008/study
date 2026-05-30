import { NextResponse } from 'next/server';
import { validateMagicBytesArray } from '@/lib/utils/magicBytes';

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'text/plain',
]);

export interface UploadValidationResult {
  valid: boolean;
  error?: NextResponse;
}

export function validateUploadedFile(
  fileBuffer: Buffer | null,
  mimeType: string | null,
  fileName?: string
): UploadValidationResult {
  if (!fileBuffer || fileBuffer.length === 0) {
    return {
      valid: false,
      error: NextResponse.json({ error: 'No file content received' }, { status: 400 }),
    };
  }

  if (fileBuffer.length > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB` },
        { status: 413 }
      ),
    };
  }

  if (!mimeType || !ALLOWED_MIME_TYPES.has(mimeType)) {
    return {
      valid: false,
      error: NextResponse.json(
        { error: `Unsupported file type: ${mimeType}. Allowed: PDF, JPEG, PNG, WebP, GIF, TXT` },
        { status: 415 }
      ),
    };
  }

  if (!validateMagicBytesArray(new Uint8Array(fileBuffer.subarray(0, 12)), mimeType)) {
    return {
      valid: false,
      error: NextResponse.json({ error: 'File contents do not match declared MIME type' }, { status: 400 }),
    };
  }

  // Reject suspiciously named files
  if (fileName) {
    const dangerousExtensions = /\.(exe|sh|bat|cmd|ps1|php|py|js|ts|rb|pl)$/i;
    if (dangerousExtensions.test(fileName)) {
      return {
        valid: false,
        error: NextResponse.json({ error: 'File type not permitted' }, { status: 400 }),
      };
    }
  }

  return { valid: true };
}

// Also validate base64 payloads in chat (image uploads)
export function validateBase64Payload(base64: string, mimeType?: string): UploadValidationResult {
  const byteLength = Math.ceil((base64.length * 3) / 4);
  if (byteLength > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: NextResponse.json({ error: 'Image too large (max 20MB)' }, { status: 413 }),
    };
  }

  if (mimeType && ALLOWED_MIME_TYPES.has(mimeType)) {
    const buffer = Buffer.from(base64, 'base64');
    if (!validateMagicBytesArray(new Uint8Array(buffer.subarray(0, 12)), mimeType)) {
      return {
        valid: false,
        error: NextResponse.json({ error: 'Image contents do not match declared MIME type' }, { status: 400 }),
      };
    }
  }

  return { valid: true };
}
