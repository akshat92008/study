import { createClient } from '@/lib/supabase/server';
import { getEmbedding } from '@/lib/ai/provider-client';
import { logger } from '@/lib/utils/logger';
import {
  buildConceptKey,
  normalizeChapter,
  normalizeConceptName,
  normalizeSubject,
  titleizeConceptLabel,
} from '@/lib/engines/concept-normalization';

export type ConceptResolutionSource =
  | 'chat'
  | 'session'
  | 'autopsy'
  | 'revision'
  | 'command'
  | 'onboarding'
  | 'ingest'
  | 'practice'
  | 'background';

export type ConceptResolutionMethod =
  | 'exact'
  | 'alias'
  | 'normalized'
  | 'fuzzy'
  | 'embedding'
  | 'created'
  | 'unresolved';

export interface ResolveConceptInput {
  userId: string;
  examType?: string | null;
  subject?: string | null;
  chapter?: string | null;
  topic?: string | null;
  questionText?: string | null;
  sourceType: ConceptResolutionSource;
  confidence?: number | null;
  client?: any;
}

export interface ConceptResolution {
  conceptId: string | null;
  confidence: number;
  method: ConceptResolutionMethod;
  normalizedSubject: string | null;
  normalizedChapter: string | null;
  normalizedTopic: string | null;
  reason?: string;
}

const SAFE_CREATE_SOURCES = new Set<ConceptResolutionSource>(['onboarding', 'ingest', 'session', 'autopsy']);

async function logResolution(
  supabase: any,
  input: ResolveConceptInput,
  result: ConceptResolution,
  raw: { subject: string | null; chapter: string | null; topic: string | null }
) {
  const row = {
    user_id: input.userId,
    concept_id: result.conceptId,
    source_type: input.sourceType,
    raw_subject: raw.subject,
    raw_chapter: raw.chapter,
    raw_topic: raw.topic,
    normalized_subject: result.normalizedSubject,
    normalized_chapter: result.normalizedChapter,
    normalized_topic: result.normalizedTopic,
    method: result.method,
    confidence: result.confidence,
    reason: result.reason ?? null,
  };

  const { error } = await supabase.from('concept_resolution_logs').insert(row);
  if (error) {
    logger.warn('Concept resolution log failed', { userId: input.userId, error: error.message });
  }
}

async function logUnresolved(
  supabase: any,
  input: ResolveConceptInput,
  result: ConceptResolution,
  raw: { subject: string | null; chapter: string | null; topic: string | null }
) {
  const { error } = await supabase.from('unresolved_concept_mentions').insert({
    user_id: input.userId,
    source_type: input.sourceType,
    exam_type: input.examType ?? null,
    raw_subject: raw.subject,
    raw_chapter: raw.chapter,
    raw_topic: raw.topic,
    question_text: input.questionText ?? null,
    normalized_subject: result.normalizedSubject,
    normalized_chapter: result.normalizedChapter,
    normalized_topic: result.normalizedTopic,
    confidence: result.confidence,
    reason: result.reason ?? null,
  });

  if (error) {
    logger.warn('Unresolved concept mention log failed', { userId: input.userId, error: error.message });
  }
}

async function finishResolution(
  supabase: any,
  input: ResolveConceptInput,
  result: ConceptResolution,
  raw: { subject: string | null; chapter: string | null; topic: string | null }
): Promise<ConceptResolution> {
  await logResolution(supabase, input, result, raw).catch(() => {});
  if (!result.conceptId) {
    await logUnresolved(supabase, input, result, raw).catch(() => {});
  }
  return result;
}

export async function resolveConcept(input: ResolveConceptInput): Promise<ConceptResolution> {
  const supabase = input.client ?? (await createClient());
  const raw = {
    subject: input.subject ?? null,
    chapter: input.chapter ?? null,
    topic: input.topic ?? null,
  };

  const normalizedSubject = normalizeSubject(input.subject);
  const normalizedChapter = normalizeChapter(input.chapter);
  const normalizedTopic = normalizeConceptName(input.topic) ?? normalizedChapter;
  const conceptKey = buildConceptKey({
    subject: input.subject,
    chapter: input.chapter,
    topic: input.topic,
    name: input.topic ?? input.chapter,
  });
  const extractionConfidence = Math.max(0, Math.min(1, input.confidence ?? 0.75));

  const unresolvedBase = {
    conceptId: null,
    confidence: 0,
    method: 'unresolved' as const,
    normalizedSubject,
    normalizedChapter,
    normalizedTopic,
  };

  if (!normalizedSubject && !normalizedChapter && !normalizedTopic) {
    return finishResolution(
      supabase,
      input,
      { ...unresolvedBase, reason: 'No subject/chapter/topic provided' },
      raw
    );
  }

  if (conceptKey) {
    const { data: canonicalMatch, error: canonicalError } = await supabase
      .from('concepts')
      .select('id')
      .eq('user_id', input.userId)
      .eq('concept_key', conceptKey)
      .limit(1)
      .maybeSingle();

    if (canonicalMatch?.id) {
      return finishResolution(
        supabase,
        input,
        {
          conceptId: canonicalMatch.id,
          confidence: Math.max(0.97, extractionConfidence),
          method: 'normalized',
          normalizedSubject,
          normalizedChapter,
          normalizedTopic,
          reason: 'Matched canonical concept_key',
        },
        raw
      );
    }

    if (canonicalError) {
      logger.warn('Canonical concept_key lookup failed; falling back', {
        userId: input.userId,
        error: canonicalError.message,
      });
    }
  }

  const exactQuery = supabase
    .from('concepts')
    .select('id')
    .eq('user_id', input.userId)
    .limit(1);

  if (normalizedSubject) exactQuery.ilike('subject', normalizedSubject);
  if (normalizedChapter) exactQuery.ilike('chapter', normalizedChapter);
  if (normalizedTopic) exactQuery.ilike('topic', normalizedTopic);

  const { data: exact } = await exactQuery.maybeSingle();
  if (exact?.id) {
    return finishResolution(
      supabase,
      input,
      {
        conceptId: exact.id,
        confidence: Math.max(0.95, extractionConfidence),
        method: 'exact',
        normalizedSubject,
        normalizedChapter,
        normalizedTopic,
      },
      raw
    );
  }

  const aliasCandidates = [normalizedTopic, normalizedChapter, normalizedSubject].filter(Boolean) as string[];
  if (aliasCandidates.length > 0) {
    const { data: alias } = await supabase
      .from('concept_aliases')
      .select('concept_id')
      .eq('user_id', input.userId)
      .in('normalized_alias', aliasCandidates)
      .limit(1)
      .maybeSingle();

    if (alias?.concept_id) {
      return finishResolution(
        supabase,
        input,
        {
          conceptId: alias.concept_id,
          confidence: Math.max(0.9, extractionConfidence),
          method: 'alias',
          normalizedSubject,
          normalizedChapter,
          normalizedTopic,
        },
        raw
      );
    }
  }

  const normalizedQuery = supabase
    .from('concepts')
    .select('id, subject, chapter, topic, name')
    .eq('user_id', input.userId)
    .limit(1);

  if (normalizedSubject) normalizedQuery.ilike('subject', `%${normalizedSubject}%`);
  if (normalizedChapter) normalizedQuery.ilike('chapter', `%${normalizedChapter}%`);

  const { data: normalizedMatch } = await normalizedQuery.maybeSingle();
  if (normalizedMatch?.id) {
    return finishResolution(
      supabase,
      input,
      {
        conceptId: normalizedMatch.id,
        confidence: Math.min(0.88, Math.max(0.7, extractionConfidence)),
        method: 'normalized',
        normalizedSubject,
        normalizedChapter,
        normalizedTopic,
        reason: 'Matched normalized subject/chapter text',
      },
      raw
    );
  }

  try {
    const embeddingText = [
      input.examType,
      input.subject,
      input.chapter,
      input.topic,
      input.questionText?.slice(0, 500),
    ].filter(Boolean).join(' ');
    const embedding = await getEmbedding(embeddingText, {
      userId: input.userId,
      route: 'concept-resolver',
    });

    if (embedding && embedding.length > 0) {
      const { data: semantic } = await supabase.rpc('match_concepts', {
        query_embedding: `[${embedding.join(',')}]`,
        match_threshold: 0.68,
        match_count: 1,
        p_user_id: input.userId,
      });

      if (semantic && semantic.length > 0) {
        return finishResolution(
          supabase,
          input,
          {
            conceptId: semantic[0].id,
            confidence: Math.min(0.82, extractionConfidence),
            method: 'embedding',
            normalizedSubject,
            normalizedChapter,
            normalizedTopic,
            reason: 'Matched by concept embedding search',
          },
          raw
        );
      }
    }
  } catch (err) {
    logger.warn('Semantic concept resolution failed', {
      userId: input.userId,
      subject: input.subject,
      chapter: input.chapter,
    });
  }

  const canCreate =
    SAFE_CREATE_SOURCES.has(input.sourceType) &&
    extractionConfidence >= 0.92 &&
    normalizedSubject &&
    (normalizedChapter || normalizedTopic);

  if (canCreate) {
    const subject = titleizeConceptLabel(normalizedSubject, 'General');
    const chapter = titleizeConceptLabel(normalizedChapter ?? normalizedTopic, 'General');
    const topic = titleizeConceptLabel(normalizedTopic ?? normalizedChapter, 'General');

    const { data: created, error } = await supabase
      .from('concepts')
      .insert({
        user_id: input.userId,
        name: topic,
        subject,
        chapter,
        topic,
        normalized_subject: normalizedSubject,
        normalized_chapter: normalizedChapter,
        normalized_name: normalizedTopic,
        concept_key: conceptKey,
        mastery: 'not_started',
        confidence: 'low',
        forgetting_probability: 1.0,
      })
      .select('id')
      .single();

    if (!error && created?.id) {
      return finishResolution(
        supabase,
        input,
        {
          conceptId: created.id,
          confidence: extractionConfidence,
          method: 'created',
          normalizedSubject,
          normalizedChapter,
          normalizedTopic,
          reason: 'Created from high-confidence safe source',
        },
        raw
      );
    }
  }

  logger.warn('CONCEPT_RESOLVER_MISS', {
    userId: input.userId,
    subject: input.subject,
    chapter: input.chapter,
    topic: input.topic,
    sourceType: input.sourceType,
  });

  return finishResolution(
    supabase,
    input,
    {
      ...unresolvedBase,
      confidence: extractionConfidence,
      reason: 'No exact, alias, normalized, or embedding match',
    },
    raw
  );
}

export async function resolveConceptByName(
  userId: string,
  subject: string,
  chapter: string,
  client?: any
): Promise<string | null> {
  const result = await resolveConcept({
    userId,
    subject,
    chapter,
    topic: chapter,
    sourceType: 'chat',
    confidence: 0.75,
    client,
  });

  return result.conceptId;
}
