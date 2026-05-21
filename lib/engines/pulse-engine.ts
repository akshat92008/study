import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';

// Safe, friction-based cognitive states (Mapped to existing safe DB enums)
// focused = High Momentum
// neutral = Steady
// frustrated = High Friction (Repeated mistakes)
// overwhelmed = Cognitive Overload (Accuracy drops, abandonment)
export type CognitiveState = 'focused' | 'neutral' | 'frustrated' | 'overwhelmed';

export interface PulseAdaptationConfig {
  maxDailyTasks: number;
  taskIntensity: 'light' | 'moderate' | 'intense';
  explanationDepth: 'concise' | 'standard' | 'step-by-step';
  workloadMultiplier: number;
  uiMessage: string;
}

const FRICTION_CONFIGS: Record<CognitiveState, PulseAdaptationConfig> = {
  focused: { // High Momentum
    maxDailyTasks: 12, taskIntensity: 'intense', explanationDepth: 'concise',
    workloadMultiplier: 1.2, uiMessage: "Momentum is high. Queuing challenging concepts."
  },
  neutral: { // Steady
    maxDailyTasks: 8, taskIntensity: 'moderate', explanationDepth: 'standard',
    workloadMultiplier: 1.0, uiMessage: "Steady learning velocity. Proceeding with standard mission."
  },
  frustrated: { // High Friction (Stuck on concepts)
    maxDailyTasks: 6, taskIntensity: 'light', explanationDepth: 'step-by-step',
    workloadMultiplier: 0.7, uiMessage: "High study friction detected. Shifting to step-by-step review mode."
  },
  overwhelmed: { // Cognitive Overload (Fatigue)
    maxDailyTasks: 4, taskIntensity: 'light', explanationDepth: 'standard',
    workloadMultiplier: 0.5, uiMessage: "Cognitive overload detected. Reducing daily targets to prioritize retention over speed."
  }
};

export async function detectStudyFriction(userId: string): Promise<{ state: CognitiveState; confidence: number; frictionScore: number }> {
  const supabase = await createClient();

  try {
    // 1. Fetch Deep Telemetry (Last 48 Hours)
    const [snapshotsRes, sessionsRes, tasksRes, cardsRes, timingRes] = await Promise.all([
      supabase.from('performance_snapshots').select('accuracy').eq('user_id', userId).order('date', { ascending: false }).limit(3),
      supabase.from('study_sessions').select('duration_minutes').eq('user_id', userId).order('started_at', { ascending: false }).limit(5),
      supabase.from('study_tasks').select('scheduled_date, completed_at').eq('user_id', userId).eq('is_completed', true).order('completed_at', { ascending: false }).limit(10),
      supabase.from('revision_cards').select('lapses').eq('user_id', userId).order('last_review', { ascending: false }).limit(20),
      supabase.from('pulse_signals').select('notes').eq('user_id', userId).eq('signal_type', 'message_timing').order('created_at', { ascending: false }).limit(5)
    ]);

    let frictionScore = 0; // 0 = High Momentum, 100 = Severe Overload / Confidence Collapse
    
    // Signal 1: Accuracy Velocity (Max +30)
    const accuracies = (snapshotsRes.data || []).map(s => s.accuracy || 0);
    if (accuracies.length >= 2) {
      if (accuracies[0] < accuracies[1] - 0.20) frictionScore += 30; // Massive sudden drop
      else if (accuracies[0] < accuracies[1] - 0.10) frictionScore += 15;
    }
    if (accuracies[0] !== undefined && accuracies[0] < 0.5) frictionScore += 20;

    // Signal 2: Session Abandonment (Max +25)
    // Multiple sessions under 5 minutes indicates inability to focus/engage
    const sessions = sessionsRes.data || [];
    const abandonedSessions = sessions.filter(s => (s.duration_minutes || 0) < 5).length;
    if (abandonedSessions >= 3) frictionScore += 25;
    else if (abandonedSessions >= 2) frictionScore += 15;

    // Signal 3: Consistency / Delayed Tasks (Max +15)
    const tasks = tasksRes.data || [];
    let delayedTasks = 0;
    tasks.forEach(t => {
      if (t.completed_at && t.scheduled_date) {
        const diffHours = (new Date(t.completed_at).getTime() - new Date(t.scheduled_date).getTime()) / (1000 * 60 * 60);
        if (diffHours > 24) delayedTasks++; // Completed a day late
      }
    });
    if (delayedTasks >= 3) frictionScore += 15;

    // Signal 4: Retrieval Performance / FSRS Lapses (Max +15)
    const cards = cardsRes.data || [];
    const highLapses = cards.filter(c => (c.lapses || 0) > 2).length;
    if (highLapses >= 5) frictionScore += 15;
    else if (highLapses >= 3) frictionScore += 10;

    // Signal 5: Tutor Hesitation (Max +15)
    const timings = timingRes.data || [];
    let highHesitation = 0;
    timings.forEach(t => {
      try {
        const parsed = JSON.parse(t.notes || '{}');
        if ((parsed.hesitation || 0) > 6) highHesitation++;
      } catch {}
    });
    if (highHesitation >= 3) frictionScore += 15;

    // Cap at 100
    frictionScore = Math.min(frictionScore, 100);

    // 2. Map Friction Score to Safe Cognitive State
    let determinedState: CognitiveState = 'neutral';
    if (frictionScore >= 75) determinedState = 'overwhelmed'; // Spiral / Confidence Collapse
    else if (frictionScore >= 45) determinedState = 'frustrated'; // Fatigue / Burnout Risk
    else if (frictionScore <= 15 && (accuracies[0] || 0) > 0.8) determinedState = 'focused'; // Momentum

    logger.info('PULSE Friction Telemetry Calculated', { userId, frictionScore, determinedState });

    return { state: determinedState, confidence: 0.85, frictionScore };

  } catch (error) {
    logger.error('Failed to calculate PULSE friction', error);
    return { state: 'neutral', confidence: 0.1, frictionScore: 20 }; // Safe fallback
  }
}

export function getAdaptiveConfig(state: CognitiveState): PulseAdaptationConfig {
  return FRICTION_CONFIGS[state] || FRICTION_CONFIGS.neutral;
}

export async function logPulseSignal(userId: string, state: CognitiveState) {
  const supabase = await createClient();

  // Log as purely academic telemetry (no clinical data)
  await supabase.from('pulse_signals').insert({
    user_id: userId,
    signal_type: 'self_report',
    emotional_state: state, // Using existing DB enum safely
    confidence: 0.95,
  });

  // Update profile
  await supabase.from('profiles').update({
    emotional_state: state,
    last_active_at: new Date().toISOString(),
  }).eq('id', userId);

  return { state, config: getAdaptiveConfig(state) };
}

// ==========================================
// Backward Compatibility Aliases for Safety
// ==========================================
export type EmotionalState = CognitiveState;
export type AdaptiveConfig = PulseAdaptationConfig;

export async function detectEmotionalState(userId: string): Promise<{ state: CognitiveState; confidence: number }> {
  return detectStudyFriction(userId);
}

export async function recordMessageTiming(
  userId: string,
  responseTimeMs: number,
  messageLength: number,
  isCorrectAnswer: boolean | null
): Promise<void> {
  const supabase = await createClient();

  try {
    // 2. Compute hesitation score (0-10)
    let hesitation = 1;
    if (responseTimeMs > 30000) {
      hesitation = 8;
    } else if (responseTimeMs > 15000) {
      hesitation = 5;
    } else if (responseTimeMs < 3000 && messageLength < 10) {
      hesitation = 6;
    }

    const emotionalState = hesitation > 6 ? 'frustrated' : hesitation > 3 ? 'neutral' : 'focused';

    // 3. Insert a row into pulse_signals
    await supabase.from('pulse_signals').insert({
      user_id: userId,
      signal_type: 'message_timing',
      emotional_state: emotionalState,
      confidence: 0.4,
      interaction_count: messageLength,
      notes: JSON.stringify({ responseTimeMs, hesitation, isCorrectAnswer })
    });

    // 4. Fetch last 5 message_timing signals
    const { data: signals, error } = await supabase
      .from('pulse_signals')
      .select('notes')
      .eq('user_id', userId)
      .eq('signal_type', 'message_timing')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      logger.warn('Failed to fetch pulse signals for timing check', error);
      return;
    }

    if (signals && signals.length === 5) {
      const allHesitant = signals.every(s => {
        try {
          const parsed = JSON.parse(s.notes || '{}');
          return (parsed.hesitation || 0) > 5;
        } catch {
          return false;
        }
      });

      if (allHesitant) {
        const friction = await detectEmotionalState(userId);
        if (friction.state === 'frustrated' || friction.state === 'overwhelmed') {
          await supabase
            .from('profiles')
            .update({ emotional_state: friction.state })
            .eq('id', userId);
          logger.info('Updated user emotional state via PULSE timing triggers', { userId, state: friction.state });
        }
      }
    }
  } catch (error) {
    logger.warn('Error in recordMessageTiming', error);
  }
}
