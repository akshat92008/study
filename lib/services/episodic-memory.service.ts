import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';

export type EpisodicSourceType =
  | 'global_chat'
  | 'mentor_chat'
  | 'tutor_chat'
  | 'session_chat'
  | 'autopsy'
  | 'memory_review';

const IMPORTANT_PATTERN =
  /\b(burnt out|burned out|scared|afraid|panic|overwhelmed|frustrated|stuck|confus(?:ed|ion)|weak|mistake|mock|score|commit|promise|goal|deadline|sunday|tomorrow|test|hess|law|electrophile|nucleophile)\b/i;

const TRIVIAL_PATTERN = /^(ok|okay|yes|no|thanks|thank you|got it|cool|hmm|fine)[.! ]*$/i;

function clampScore(value: number): number {
  return Math.max(0, Math.min(10, Math.round(value * 10) / 10));
}

export function shouldCreateEpisode(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 20) return IMPORTANT_PATTERN.test(trimmed);
  if (TRIVIAL_PATTERN.test(trimmed)) return false;
  return IMPORTANT_PATTERN.test(trimmed) || trimmed.length > 180;
}

export function scoreEpisode(text: string): { importanceScore: number; emotionalSalience: number; retrievalWeight: number } {
  const emotionalSalience = clampScore(
    /\b(burnt out|burned out|scared|afraid|panic|overwhelmed|frustrated|anxious)\b/i.test(text) ? 8 : 3
  );
  const importanceScore = clampScore(
    /\b(goal|deadline|commit|mock|score|mistake|weak|confus|stuck)\b/i.test(text) ? 7 : 5
  );
  return {
    importanceScore,
    emotionalSalience,
    retrievalWeight: clampScore(importanceScore * 0.7 + emotionalSalience * 0.3),
  };
}

function summarizeEpisode(text: string, sourceType: EpisodicSourceType): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  const prefix = sourceType === 'autopsy'
    ? 'Autopsy evidence'
    : sourceType === 'mentor_chat'
      ? 'Mentor conversation'
      : sourceType === 'tutor_chat'
        ? 'Tutor conversation'
        : 'Student conversation';
  return `${prefix}: ${cleaned.slice(0, 280)}${cleaned.length > 280 ? '...' : ''}`;
}

export class EpisodicMemoryService {
  async writeEpisode(input: {
    userId: string;
    text: string;
    sourceType: EpisodicSourceType;
    sourceId?: string | null;
    metadata?: Record<string, any>;
  }): Promise<void> {
    const text = input.text.trim();
    if (!shouldCreateEpisode(text)) return;

    const scores = scoreEpisode(text);
    const supabase = await createClient();

    if (input.sourceId) {
      const { data: existing } = await supabase
        .from('episodic_memories')
        .select('id')
        .eq('user_id', input.userId)
        .eq('source_type', input.sourceType)
        .eq('source_id', input.sourceId)
        .maybeSingle();
      if (existing?.id) return;
    }

    const { error } = await supabase
      .from('episodic_memories')
      .insert({
        user_id: input.userId,
        summary: summarizeEpisode(text, input.sourceType),
        source_type: input.sourceType,
        source_id: input.sourceId ?? null,
        importance_score: scores.importanceScore,
        emotional_salience: scores.emotionalSalience,
        retrieval_weight: scores.retrievalWeight,
        metadata: input.metadata ?? {},
      });

    if (error) {
      logger.warn('Failed to write episodic memory', {
        userId: input.userId,
        sourceType: input.sourceType,
        error: error.message,
      });
    }
  }

  async retrieveRelevant(userId: string, query: string, limit = 3): Promise<string[]> {
    const supabase = await createClient();
    const sanitizedQuery = query.replace(/[^\w\s]/gi, ' ').trim().split(/\s+/).filter(Boolean).join(' | ');

    let rows: any[] = [];
    if (sanitizedQuery) {
      const { data } = await supabase
        .from('episodic_memories')
        .select('id, summary, retrieval_weight, importance_score, emotional_salience, created_at')
        .eq('user_id', userId)
        .textSearch('summary', sanitizedQuery)
        .order('retrieval_weight', { ascending: false })
        .limit(limit);
      rows = data ?? [];
    }

    if (!rows.length) {
      const { data } = await supabase
        .from('episodic_memories')
        .select('id, summary, retrieval_weight, importance_score, emotional_salience, created_at')
        .eq('user_id', userId)
        .order('retrieval_weight', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limit);
      rows = data ?? [];
    }

    if (rows.length) {
      await supabase
        .from('episodic_memories')
        .update({ last_referenced_at: new Date().toISOString() })
        .in('id', rows.map((row) => row.id));
    }

    return rows.map((row) => row.summary).filter(Boolean);
  }
}
