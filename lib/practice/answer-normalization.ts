function normalizeOptionText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^\s*(?:option\s*)?\(?[a-d]\)?[\s).:-]*/i, '')
    .replace(/\s*\([a-d]\)\s*$/i, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function normalizeMcqAnswer(rawAnswer: unknown, options: unknown[] = []): string {
  const raw = String(rawAnswer ?? '').trim();
  if (!raw) return '';

  const directLetter =
    raw.match(/^(?:\*\*|__)?\s*(?:option\s*)?\(?([A-D])\)?(?:\*\*|__)?\s*(?:[).:-]|\s|$)/i) ||
    raw.match(/\b(?:option\s*)\(?([A-D])\)?\b/i);
  if (directLetter) return directLetter[1].toUpperCase();

  const trailingLetter = raw.match(/\(([A-D])\)\s*$/i);
  if (trailingLetter) return trailingLetter[1].toUpperCase();

  const normalizedRaw = normalizeOptionText(raw);
  const normalizedOptions = options.map((option) => normalizeOptionText(String(option ?? '')));

  const exactIndex = normalizedOptions.findIndex((option) => option && option === normalizedRaw);
  if (exactIndex >= 0) return String.fromCharCode(65 + exactIndex);

  const containsIndex = normalizedOptions.findIndex((option) => {
    if (!option || !normalizedRaw) return false;
    return normalizedRaw.includes(option) || option.includes(normalizedRaw);
  });
  if (containsIndex >= 0) return String.fromCharCode(65 + containsIndex);

  return raw.toUpperCase();
}

export function areMcqAnswersEquivalent(
  submittedAnswer: unknown,
  correctAnswer: unknown,
  options: unknown[] = []
): boolean {
  const submitted = normalizeMcqAnswer(submittedAnswer, options);
  const correct = normalizeMcqAnswer(correctAnswer, options);
  return Boolean(submitted && correct && submitted === correct);
}
