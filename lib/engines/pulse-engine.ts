import { createClient } from '@/lib/supabase/server';

type EmotionalState = 'focused' | 'motivated' | 'stressed' | 'burnt_out' | 'anxious' | 'frustrated' | 'confident' | 'overwhelmed' | 'bored' | 'neutral';

interface AdaptiveConfig {
  maxDailyTasks: number;
  difficultyLevel: 'easy' | 'medium' | 'hard';
  breakFrequencyMinutes: number;
  workloadMultiplier: number;
  uiMessage: string;
  uiTone: 'push' | 'encourage' | 'calm' | 'rest';
}

const ADAPTIVE_CONFIGS: Record<EmotionalState, AdaptiveConfig> = {
  focused: {
    maxDailyTasks: 12, difficultyLevel: 'hard', breakFrequencyMinutes: 60,
    workloadMultiplier: 1.2, uiMessage: "You're in the zone. Let's tackle the hardest topics now.",
    uiTone: 'push',
  },
  motivated: {
    maxDailyTasks: 10, difficultyLevel: 'hard', breakFrequencyMinutes: 50,
    workloadMultiplier: 1.1, uiMessage: "Energy is high — capitalize on it. Hard chapter time.",
    uiTone: 'push',
  },
  confident: {
    maxDailyTasks: 10, difficultyLevel: 'hard', breakFrequencyMinutes: 55,
    workloadMultiplier: 1.0, uiMessage: "Confidence is good. Don't confuse it with mastery — verify with practice.",
    uiTone: 'encourage',
  },
  neutral: {
    maxDailyTasks: 8, difficultyLevel: 'medium', breakFrequencyMinutes: 45,
    workloadMultiplier: 1.0, uiMessage: "Steady state. Follow the plan.",
    uiTone: 'encourage',
  },
  stressed: {
    maxDailyTasks: 6, difficultyLevel: 'medium', breakFrequencyMinutes: 35,
    workloadMultiplier: 0.7, uiMessage: "I've reduced your workload today. Focus on what you know — build momentum.",
    uiTone: 'calm',
  },
  anxious: {
    maxDailyTasks: 5, difficultyLevel: 'easy', breakFrequencyMinutes: 30,
    workloadMultiplier: 0.6, uiMessage: "Deep breath. You're further ahead than you think. Let's do easy wins today.",
    uiTone: 'calm',
  },
  frustrated: {
    maxDailyTasks: 6, difficultyLevel: 'easy', breakFrequencyMinutes: 30,
    workloadMultiplier: 0.65, uiMessage: "Switch approach. Let's try different topics and come back to this fresh.",
    uiTone: 'calm',
  },
  overwhelmed: {
    maxDailyTasks: 4, difficultyLevel: 'easy', breakFrequencyMinutes: 25,
    workloadMultiplier: 0.5, uiMessage: "You don't need to do everything today. Just 3 things. That's enough.",
    uiTone: 'rest',
  },
  burnt_out: {
    maxDailyTasks: 3, difficultyLevel: 'easy', breakFrequencyMinutes: 20,
    workloadMultiplier: 0.3, uiMessage: "Your brain needs recovery. Light revision only. Take a walk. You'll be sharper tomorrow.",
    uiTone: 'rest',
  },
  bored: {
    maxDailyTasks: 8, difficultyLevel: 'hard', breakFrequencyMinutes: 40,
    workloadMultiplier: 0.9, uiMessage: "Bored? That means it's too easy. Let's challenge you with harder problems.",
    uiTone: 'push',
  },
};

// Detect emotional state from behavioral signals
export async function detectEmotionalState(userId: string): Promise<{ state: EmotionalState; confidence: number }> {
  const supabase = await createClient();

  // Signal 1: Recent self-reported mood (highest weight)
  const { data: recentPulse } = await supabase
    .from('pulse_signals')
    .select('emotional_state, confidence')
    .eq('user_id', userId)
    .eq('signal_type', 'self_report')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (recentPulse) {
    const hoursSince = 2; // If self-reported within last 2 hours, trust it fully
    return { state: recentPulse.emotional_state as EmotionalState, confidence: recentPulse.confidence || 0.9 };
  }

  // Signal 2: Performance trend analysis
  const { data: recentSnapshots } = await supabase
    .from('performance_snapshots')
    .select('accuracy, focus_score, study_minutes, emotional_state')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(5);

  if (recentSnapshots && recentSnapshots.length >= 3) {
    const avgAccuracy = recentSnapshots.reduce((s: number, r: any) => s + (r.accuracy || 0), 0) / recentSnapshots.length;
    const avgFocus = recentSnapshots.reduce((s: number, r: any) => s + (r.focus_score || 50), 0) / recentSnapshots.length;
    const avgStudyMins = recentSnapshots.reduce((s: number, r: any) => s + (r.study_minutes || 0), 0) / recentSnapshots.length;

    // Declining accuracy + low focus = stressed/burnt_out
    if (avgAccuracy < 0.4 && avgFocus < 30) return { state: 'burnt_out', confidence: 0.6 };
    if (avgAccuracy < 0.5 && avgFocus < 50) return { state: 'stressed', confidence: 0.55 };
    if (avgAccuracy > 0.8 && avgFocus > 70) return { state: 'focused', confidence: 0.65 };
    if (avgAccuracy > 0.7 && avgStudyMins > 120) return { state: 'motivated', confidence: 0.6 };
  }

  // Signal 3: Session pattern (have they been studying consistently?)
  const { data: recentSessions } = await supabase
    .from('study_sessions')
    .select('duration_minutes, focus_score')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(3);

  if (recentSessions && recentSessions.length > 0) {
    const avgDuration = recentSessions.reduce((s: number, r: any) => s + (r.duration_minutes || 0), 0) / recentSessions.length;
    if (avgDuration < 15) return { state: 'overwhelmed', confidence: 0.45 };
  }

  // Default: neutral
  return { state: 'neutral', confidence: 0.3 };
}

// Get adaptive configuration based on current mental state
export function getAdaptiveConfig(state: EmotionalState): AdaptiveConfig {
  return ADAPTIVE_CONFIGS[state] || ADAPTIVE_CONFIGS.neutral;
}

// Log a pulse signal (self-report or automated)
export async function logPulseSignal(
  userId: string,
  signalType: 'self_report' | 'session_pattern' | 'performance_trend',
  emotionalState: EmotionalState,
  extras?: { sessionDurationMinutes?: number; recentAccuracy?: number; interactionCount?: number; notes?: string }
) {
  const supabase = await createClient();

  await supabase.from('pulse_signals').insert({
    user_id: userId,
    signal_type: signalType,
    emotional_state: emotionalState,
    confidence: signalType === 'self_report' ? 0.95 : 0.5,
    session_duration_minutes: extras?.sessionDurationMinutes,
    recent_accuracy: extras?.recentAccuracy,
    interaction_count: extras?.interactionCount,
    notes: extras?.notes,
  });

  // Also update the profile's current emotional state
  await supabase.from('profiles').update({
    emotional_state: emotionalState,
    last_active_at: new Date().toISOString(),
  }).eq('id', userId);

  return { state: emotionalState, config: getAdaptiveConfig(emotionalState) };
}
