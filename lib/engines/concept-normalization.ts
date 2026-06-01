const CHAPTER_ALIASES: Record<string, string> = {
  electrostatic: 'electric charge field',
  electrostatics: 'electric charge field',
  'electric charge field': 'electric charge field',
  'electric charges fields': 'electric charge field',
  'electric charge fields': 'electric charge field',
  'electric charges field': 'electric charge field',
};

function compactAcademicText(value?: string | null): string | null {
  if (!value) return null;
  const normalized = value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/\+/g, ' plus ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

  if (!normalized) return null;

  const words = normalized
    .split(' ')
    .filter(word => word !== 'and' && word !== 'the' && word !== 'of')
    .map(word => {
      if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
      if (word.length > 3 && word.endsWith('s')) return word.slice(0, -1);
      return word;
    });

  const compacted = words.join(' ').trim();
  return compacted || null;
}

export function normalizeSubject(value?: string | null): string | null {
  const normalized = compactAcademicText(value);
  if (!normalized) return null;
  if (/physics/i.test(value ?? '')) return 'physics';
  if (/mathematics|maths|math/i.test(value ?? '')) return 'mathematics';
  return normalized;
}

export function normalizeChapter(value?: string | null): string | null {
  const normalized = compactAcademicText(value);
  if (!normalized) return null;
  return CHAPTER_ALIASES[normalized] ?? normalized;
}

export function normalizeConceptName(value?: string | null): string | null {
  return compactAcademicText(value);
}

export function buildConceptKey(input: {
  subject?: string | null;
  chapter?: string | null;
  name?: string | null;
  topic?: string | null;
}): string | null {
  const subject = normalizeSubject(input.subject);
  const chapter = normalizeChapter(input.chapter);
  const name = normalizeConceptName(input.name ?? input.topic ?? input.chapter);

  if (!subject && !chapter && !name) return null;
  return [subject ?? 'general', chapter ?? 'general', name ?? chapter ?? 'general'].join('::');
}

export function titleizeConceptLabel(value: string | null, fallback: string): string {
  const source = value || fallback;
  return source
    .split(' ')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
