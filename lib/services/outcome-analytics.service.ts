import { createClient } from '@/lib/supabase/server';

export type OutcomeAnalyticsSummary = {
  scoreTrend: 'improving' | 'declining' | 'flat' | 'insufficient_data';
  latestScore: number | null;
  previousScore: number | null;
  recoverableMarksTrend: number | null;
  featureUsage: {
    chatSessions: number;
    autopsyUploads: number;
    revisionCardsReviewed: number;
    studySessionsCompleted: number;
  };
  usageAssociation: string;
};

function trend(latest: number | null, previous: number | null): OutcomeAnalyticsSummary['scoreTrend'] {
  if (latest === null || previous === null) return 'insufficient_data';
  if (latest > previous) return 'improving';
  if (latest < previous) return 'declining';
  return 'flat';
}

export class OutcomeAnalyticsService {
  constructor(private readonly client?: Awaited<ReturnType<typeof createClient>> | any) {}

  async getSummary(userId: string): Promise<OutcomeAnalyticsSummary> {
    const supabase = this.client ?? await createClient();
    const { data: autopsies } = await supabase
      .from('mock_autopsies')
      .select('current_score, recoverable_marks, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);

    const latestScore = autopsies?.[0]?.current_score ?? null;
    const previousScore = autopsies?.[1]?.current_score ?? null;
    const latestRecoverable = autopsies?.[0]?.recoverable_marks ?? null;
    const previousRecoverable = autopsies?.[1]?.recoverable_marks ?? null;

    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const [chatSessions, autopsyUploads, revisionReviews, studySessions] = await Promise.all([
      supabase.from('chat_sessions').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', since),
      supabase.from('mock_autopsies').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', since),
      supabase.from('revision_logs').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', since),
      supabase.from('study_sessions').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('is_completed', true).gte('created_at', since),
    ]);

    const scoreTrend = trend(latestScore, previousScore);
    const activeLoops =
      (chatSessions.count ?? 0) +
      (autopsyUploads.count ?? 0) +
      (revisionReviews.count ?? 0) +
      (studySessions.count ?? 0);

    return {
      scoreTrend,
      latestScore,
      previousScore,
      recoverableMarksTrend:
        latestRecoverable === null || previousRecoverable === null
          ? null
          : latestRecoverable - previousRecoverable,
      featureUsage: {
        chatSessions: chatSessions.count ?? 0,
        autopsyUploads: autopsyUploads.count ?? 0,
        revisionCardsReviewed: revisionReviews.count ?? 0,
        studySessionsCompleted: studySessions.count ?? 0,
      },
      usageAssociation: activeLoops > 0
        ? 'Recent improvement should be interpreted as associated with product loop usage, not caused by it.'
        : 'No recent product loop usage is available to associate with score movement.',
    };
  }
}
