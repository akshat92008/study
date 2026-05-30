export async function validateMagicBytes(file: File, expectedMime: string): Promise<boolean> {
  const arr = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  const hex = Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();

  switch (expectedMime) {
    case 'application/pdf':
      return hex.startsWith('25504446'); // %PDF
    case 'image/jpeg':
      return hex.startsWith('FFD8FF');
    case 'image/png':
      return hex.startsWith('89504E47');
    case 'image/webp':
      // RIFF....WEBP. Magic bytes for WEBP start with RIFF
      return hex.startsWith('52494646');
    default:
      // Text formats don't have strict magic bytes, assume valid for now
      return true;
  }
}
