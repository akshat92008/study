// lib/events/sanitizer.ts

/**
 * Basic PII sanitization middleware.
 * For production you would replace this with a robust library that can detect
 * names, emails, IDs, etc. Here we implement a simple placeholder that redacts
 * common patterns.
 */
export function sanitizeEventData(data: any): any {
  if (data == null) return data;
  const clone = JSON.parse(JSON.stringify(data)); // deep copy

  const redactString = (value: string): string => {
    // Simple regexes for email and phone numbers – replace with ****
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const phoneRegex = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g;
    return value.replace(emailRegex, '[redacted-email]').replace(phoneRegex, '[redacted-phone]');
  };

  const traverse = (obj: any): any => {
    if (typeof obj === 'string') {
      return redactString(obj);
    }
    if (Array.isArray(obj)) {
      return obj.map(traverse);
    }
    if (obj && typeof obj === 'object') {
      for (const key of Object.keys(obj)) {
        obj[key] = traverse(obj[key]);
      }
    }
    return obj;
  };

  return traverse(clone);
}
