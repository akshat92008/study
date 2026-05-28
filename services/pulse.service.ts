// services/pulse.service.ts
// Real implementation: reads from profiles.emotional_state + review_logs for fatigue.
// Replaces the 12-line hardcoded stub.

import { BaseService } from './base.service';
import { createClient } from '@/lib/supabase/server';

export type EmotionalState =
  | 'focused' | 'motivated' | 'stressed' | 'burnt_out'
  | 'anxious' | 'frustrated' | 'confident' | 'overwhelmed'
  | 'bored' | 'neutral';

export type FatigueLevel = 'low' | 'medium' | 'high' | 'critical';

export interface PulseState {
  emotionalState: EmotionalState;
  sessionFatigue: FatigueLevel;
  // Additional signals for UI adaptation
  cardsReviewedThisSession: number;
  minutesActiveThisSession: number;
  streakDays: number;
  lastActiveAt: string | null;
  fatigueScore: number; // 0–100
}

const FATIGUE_THRESHOLDS = {
  low: 25,
  medium: 50,
  high: 75,
  // > 75 = critical
};

function scoreToFatigue(score: number): FatigueLevel {
  if (score <= FATIGUE_THRESHOLDS.low) return 'low';
  if (score <= FATIGUE_THRESHOLDS.medium) return 'medium';
  if (score <= FATIGUE_THRESHOLDS.high) return 'high';
  return 'critical';
}

export class PulseService extends BaseService {
  async getPulseState(userId: string): Promise<PulseState> {
    try {
      const supabase = await createClient();

      // 1. Fetch emotional state + streak from profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('emotional_state, current_streak, last_active_at')
        .eq('id', userId)
        .single();

      const emotionalState: EmotionalState =
        (profile?.emotional_state as EmotionalState) ?? 'neutral';
      const streakDays = profile?.current_streak ?? 0;
      const lastActiveAt = profile?.last_active_at ?? null;

      // 2. Count cards reviewed in the last 2 hours (session proxy)
      const sessionStart = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const { count: cardsReviewed } = await supabase
        .from('review_logs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('reviewed_at', sessionStart);

      const cardsReviewedThisSession = cardsReviewed ?? 0;

      // 3. Estimate minutes active from message count in last 2 hours
      const { count: messageCount } = await supabase
        .from('chat_messages')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('role', 'user')
        .gte('created_at', sessionStart);

      // Rough heuristic: ~3 min per message exchange
      const minutesActiveThisSession = Math.min((messageCount ?? 0) * 3, 120);

      // 4. Compute fatigue score
      // Factors: cards reviewed (weight 40), time active (weight 30), emotional state (weight 30)
      const cardsFatigue = Math.min((cardsReviewedThisSession / 50) * 40, 40); // caps at 50 cards
      const timeFatigue = Math.min((minutesActiveThisSession / 90) * 30, 30);  // caps at 90 min

      const emotionalFatigue: Record<EmotionalState, number> = {
        focused: 0,
        motivated: 0,
        confident: 5,
        neutral: 10,
        bored: 15,
        anxious: 20,
        stressed: 25,
        frustrated: 25,
        overwhelmed: 30,
        burnt_out: 30,
      };
      const stateFatigue = emotionalFatigue[emotionalState] ?? 10;

      const fatigueScore = Math.round(cardsFatigue + timeFatigue + stateFatigue);

      return {
        emotionalState,
        sessionFatigue: scoreToFatigue(fatigueScore),
        cardsReviewedThisSession,
        minutesActiveThisSession,
        streakDays,
        lastActiveAt,
        fatigueScore,
      };
    } catch (err) {
      console.error('[PulseService] Error reading pulse state:', err);
      // Graceful fallback — never crash the caller
      return {
        emotionalState: 'neutral',
        sessionFatigue: 'low',
        cardsReviewedThisSession: 0,
        minutesActiveThisSession: 0,
        streakDays: 0,
        lastActiveAt: null,
        fatigueScore: 0,
      };
    }
  }
}
