export function normalizeText(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
export function slugify(value: unknown): string {
  const normalized = normalizeText(value).replace(/\s+/g, '-');
  return normalized || 'item';
}
export function includesAny(haystack: string, needles: string[]): boolean {
  const normalized = normalizeText(haystack);
  return needles.some((needle) => normalized.includes(normalizeText(needle)));
}
export function buildGoalHaystack(input: {
  goalTitle?: string | null;
  goalType?: string | null;
  presetId?: string | null;
  subjects?: string[] | null;
  subject?: string | null;
  chapter?: string | null;
}): string {
  return normalizeText(
    [
      input.goalTitle,
      input.goalType,
      input.presetId,
      input.subject,
      input.chapter,
      ...(input.subjects ?? []),
    ]
      .filter(Boolean)
      .join(' ')
  );
}
