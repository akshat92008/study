export async function validateMagicBytes(file: File, expectedMime: string): Promise<boolean> {
  const arr = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  return validateMagicBytesArray(arr, expectedMime);
}

export function validateMagicBytesArray(arr: Uint8Array, expectedMime: string): boolean {
  const hex = Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();

  switch (expectedMime) {
    case 'application/pdf':
      return hex.startsWith('25504446'); // %PDF
    case 'image/jpeg':
      return hex.startsWith('FFD8FF');
    case 'image/png':
      return hex.startsWith('89504E47');
    case 'image/webp':
      // WebP must be RIFF....WEBP, not just any RIFF container.
      return arr.length >= 12 &&
        hex.startsWith('52494646') &&
        Array.from(arr.slice(8, 12)).map(b => String.fromCharCode(b)).join('') === 'WEBP';
    default:
      // Text formats don't have strict magic bytes, assume valid for now
      return true;
  }
}
