// lib/hermes/hermes-internal-utils.ts
// Internal shared utilities for the Hermes module.
// NOT exported from index.ts — internal use only.

export function readBool(name: string, defaultValue: boolean): boolean {
  const v = process.env[name];
  if (v == null || v === '') return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
}

export function readInt(name: string, defaultValue: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : defaultValue;
}

export function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + '…';
}

export function compactArray<T>(arr: T[] | null | undefined, maxItems: number): T[] {
  if (!arr || arr.length === 0) return [];
  return arr.slice(0, maxItems);
}

export function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return '[unserializable]';
  }
}
