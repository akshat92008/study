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

export async function detectStudyFriction(userId: string): Promise<{ state: CognitiveState; confidence: number }> {
  const supabase = await createClient();

  try {
    // 1. Fetch Deep Telemetry (Last 48 Hours)
    const [snapshotsRes, sessionsRes, tasksRes, mistakesRes] = await Promise.all([
      supabase.from('performance_snapshots').select('accuracy').eq('user_id', userId).order('date', { ascending: false }).limit(3),
      supabase.from('study_sessions').select('duration_minutes').eq('user_id', userId).order('started_at', { ascending: false }).limit(5),
      supabase.from('study_tasks').select('scheduled_date, completed_at').eq('user_id', userId).eq('is_completed', true).order('completed_at', { ascending: false }).limit(10),
      supabase.from('mistakes').select('occurrence_count').eq('user_id', userId).order('created_at', { ascending: false }).limit(10)
    ]);

    let frictionScore = 0; // 0 = High Momentum, 10 = Severe Overload
    
    // Signal A: Accuracy Drops (Weight: +3)
    const accuracies = (snapshotsRes.data || []).map(s => s.accuracy || 0);
    if (accuracies.length >= 2 && accuracies[0] < accuracies[1] - 0.15) frictionScore += 3;
    else if (accuracies[0] < 0.5) frictionScore += 2;

    // Signal B: Session Abandonment (Weight: +3)
    // Multiple sessions under 5 minutes indicates inability to focus/engage
    const sessions = sessionsRes.data || [];
    const abandonedSessions = sessions.filter(s => (s.duration_minutes || 0) < 5).length;
    if (abandonedSessions >= 2) frictionScore += 3;

    // Signal C: Delayed Completion (Weight: +2)
    const tasks = tasksRes.data || [];
    let delayedTasks = 0;
    tasks.forEach(t => {
      if (t.completed_at && t.scheduled_date) {
        const diffHours = (new Date(t.completed_at).getTime() - new Date(t.scheduled_date).getTime()) / (1000 * 60 * 60);
        if (diffHours > 24) delayedTasks++; // Completed a day late
      }
    });
    if (delayedTasks >= 3) frictionScore += 2;

    // Signal D: Repeated Mistakes (Weight: +2)
    const mistakes = mistakesRes.data || [];
    const repeated = mistakes.filter(m => (m.occurrence_count || 1) > 1).length;
    if (repeated >= 3) frictionScore += 2;

    // 2. Map Friction Score to Safe Cognitive State
    let determinedState: CognitiveState = 'neutral';
    if (frictionScore >= 7) determinedState = 'overwhelmed';
    else if (frictionScore >= 4) determinedState = 'frustrated';
    else if (frictionScore === 0 && (accuracies[0] || 0) > 0.8) determinedState = 'focused';

    logger.info('PULSE Friction Telemetry Calculated', { userId, frictionScore, determinedState });

    return { state: determinedState, confidence: 0.85 };

  } catch (error) {
    logger.error('Failed to calculate PULSE friction', error);
    return { state: 'neutral', confidence: 0.1 }; // Safe fallback
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
