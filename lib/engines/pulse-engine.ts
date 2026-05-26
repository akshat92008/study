import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';

export type CognitiveState = 'focused' | 'neutral' | 'frustrated' | 'overwhelmed';

export interface PulseAdaptationConfig {
  maxDailyTasks: number;
  taskIntensity: 'light' | 'moderate' | 'intense';
  explanationDepth: 'concise' | 'standard' | 'step-by-step';
  workloadMultiplier: number;
  uiMessage: string;
  needsCheckIn?: boolean;
}

const BASE_CONFIG: PulseAdaptationConfig = {
  maxDailyTasks: 8,
  taskIntensity: 'moderate',
  explanationDepth: 'standard',
  workloadMultiplier: 1.0,
  uiMessage: "Steady learning velocity. Proceeding with standard mission.",
  needsCheckIn: false
};

/**
 * Core Behavioral Engine
 * Evaluates strictly observable actions, no psychological guessing.
 */
export async function detectStudyFriction(userId: string): Promise<{ state: CognitiveState; confidence: number; config: PulseAdaptationConfig }> {
  const supabase = await createClient();

  try {
    const today = new Date().toISOString().split('T')[0];
    
    // 1. Fetch Behavioral Data
    const [tasksRes, sessionsRes, snapshotsRes, selfReportRes, keystrokeRes] = await Promise.all([
      // Tasks from the last 3 days
      supabase.from('study_tasks').select('scheduled_date, is_completed')
        .eq('user_id', userId)
        .lt('scheduled_date', today)
        .order('scheduled_date', { ascending: false }),
      // Last 5 study sessions
      supabase.from('study_sessions').select('duration_minutes')
        .eq('user_id', userId)
        .order('started_at', { ascending: false })
        .limit(5),
      // Last 2 daily performance snapshots
      supabase.from('performance_snapshots').select('accuracy')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(2),
      // Latest manual self-report (valid for 24h)
      supabase.from('pulse_signals').select('emotional_state, created_at')
        .eq('user_id', userId)
        .eq('signal_type', 'self_report')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      // Recent keystroke telemetry (valid for 2 hours)
      supabase.from('pulse_signals').select('notes, created_at')
        .eq('user_id', userId)
        .eq('signal_type', 'keystroke_pattern')
        .gte('created_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(5)
    ]);

    let config: PulseAdaptationConfig = { ...BASE_CONFIG };
    let determinedState: CognitiveState = 'focused';
    let uiMessages: string[] = [];

    // --- BEHAVIORAL RULE 0: Keystroke Telemetry (Immediate Real-Time Signal) ---
    // If recent keystroke patterns show friction
    const recentKeystrokes = keystrokeRes?.data || [];
    if (recentKeystrokes.length > 0) {
      let strugglingCount = 0;
      let scatteredCount = 0;
      
      for (const k of recentKeystrokes) {
        try {
          if (k.notes) {
            const data = JSON.parse(k.notes);
            if (data.inferredState === 'struggling') strugglingCount++;
            if (data.inferredState === 'scattered') scatteredCount++;
          }
        } catch (e) {}
      }

      if (strugglingCount > 0) {
        config.explanationDepth = 'step-by-step';
        config.taskIntensity = 'light';
        determinedState = 'frustrated';
        uiMessages.push("Your typing patterns suggest you might be stuck. Shifting to step-by-step mode.");
      } else if (scatteredCount > 0) {
        config.workloadMultiplier = Math.min(config.workloadMultiplier, 0.8);
        determinedState = 'overwhelmed';
        uiMessages.push("Your typing appears scattered. Reducing the cognitive load to help you focus.");
      }
    }

    // --- BEHAVIORAL RULE 1: Missed Sessions ---
    // If the student had tasks scheduled for the last 2 distinct days and completed 0 of them
    const tasks = tasksRes.data || [];
    const uniquePastDays = [...new Set(tasks.map(t => t.scheduled_date?.split('T')[0]))].filter(Boolean).slice(0, 2);
    
    if (uniquePastDays.length === 2) {
      const missedDay1 = tasks.filter(t => t.scheduled_date?.startsWith(uniquePastDays[0]!) && !t.is_completed).length === tasks.filter(t => t.scheduled_date?.startsWith(uniquePastDays[0]!)).length;
      const missedDay2 = tasks.filter(t => t.scheduled_date?.startsWith(uniquePastDays[1]!) && !t.is_completed).length === tasks.filter(t => t.scheduled_date?.startsWith(uniquePastDays[1]!)).length;
      
      if (missedDay1 && missedDay2) {
        config.workloadMultiplier = Math.min(config.workloadMultiplier, 0.7); // Reduce by 30%
        determinedState = 'neutral';
        uiMessages.push("Easing you back in after a few missed days.");
      }
    }

    const sessions = sessionsRes.data || [];
    
    // --- BEHAVIORAL RULE 4: Repeated Abandonment ---
    // Abandoned < 5 mins, 3 times in a row
    const recent3Sessions = sessions.slice(0, 3);
    if (recent3Sessions.length === 3 && recent3Sessions.every(s => (s.duration_minutes || 0) < 5)) {
      config.needsCheckIn = true;
      determinedState = 'overwhelmed';
      uiMessages.push("I noticed you've ended your last few sessions very early. Are the targets too heavy?");
    }
    // --- BEHAVIORAL RULE 2: Shorter Sessions ---
    // If actual session length < 50% of standard 45m block (~22 mins) for 3 consecutive days/sessions
    else if (recent3Sessions.length === 3 && recent3Sessions.every(s => (s.duration_minutes || 0) < 22)) {
      config.workloadMultiplier = Math.min(config.workloadMultiplier, 0.8);
      config.maxDailyTasks = 6;
      determinedState = 'neutral';
      uiMessages.push("Adjusting block lengths based on your recent session durations.");
    }

    // --- BEHAVIORAL RULE 3: Accuracy Drop ---
    // If accuracy < 40% for 2 consecutive sessions
    const snapshots = snapshotsRes.data || [];
    if (snapshots.length === 2 && snapshots.every(s => (s.accuracy || 0) < 0.40)) {
      config.explanationDepth = 'step-by-step';
      config.taskIntensity = 'light';
      determinedState = 'frustrated';
      uiMessages.push("Accuracy dropped recently. Shifting MIND to step-by-step foundational mode.");
    }

    // --- BEHAVIORAL RULE 5: Real-time Struggle (Predictive) ---
    // Check if the student has made multiple mistakes or rated cards 'Again' in the last 2 hours.
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const [recentMistakesRes, recentFailsRes] = await Promise.all([
      supabase.from('mistakes').select('id').eq('user_id', userId).gte('created_at', twoHoursAgo),
      supabase.from('review_logs').select('id').eq('user_id', userId).eq('rating', 1).gte('review', twoHoursAgo)
    ]);
    
    const recentMistakesCount = recentMistakesRes.data?.length || 0;
    const recentFailsCount = recentFailsRes.data?.length || 0;
    
    if (recentMistakesCount + recentFailsCount >= 4) {
      config.explanationDepth = 'step-by-step';
      config.taskIntensity = 'light';
      config.workloadMultiplier = Math.min(config.workloadMultiplier, 0.6);
      determinedState = 'frustrated';
      uiMessages.unshift("Real-time friction detected. You've hit a few roadblocks recently. Slowing down and shifting to foundational step-by-step mode.");
    }

    // --- EXPLICIT OVERRIDE: Self-Report ---
    // If the student explicitly told us they are overwhelmed today, we believe them immediately.
    const selfReport = selfReportRes.data;
    if (selfReport) {
      const hoursSinceReport = (Date.now() - new Date(selfReport.created_at).getTime()) / (1000 * 60 * 60);
      if (hoursSinceReport < 24) {
        determinedState = selfReport.emotional_state as CognitiveState;
        if (determinedState === 'overwhelmed') {
          config.workloadMultiplier = 0.5;
          config.taskIntensity = 'light';
          uiMessages = ["You noted you were overwhelmed. Workload is halved today."];
        } else if (determinedState === 'frustrated') {
          config.explanationDepth = 'step-by-step';
          uiMessages = ["Slowing things down based on your check-in."];
        }
      }
    }

    // Finalize UI message
    if (uiMessages.length > 0) {
      config.uiMessage = uiMessages[0]; // Take the highest priority intervention message
    } else if (determinedState === 'focused') {
      config.workloadMultiplier = 1.1; // Slight push for consistency
      config.uiMessage = "Consistency is strong. Maintaining momentum.";
    }

    return { state: determinedState, confidence: 1.0, config };

  } catch (error) {
    logger.error('Failed to calculate behavioral PULSE', error);
    return { state: 'neutral', confidence: 0.1, config: BASE_CONFIG }; // Safe fallback
  }
}

/**
 * Returns the computed config for UI usage.
 * Maintained as a synchronous mapper for backwards compatibility with UI components.
 */
export function getAdaptiveConfig(state: CognitiveState): PulseAdaptationConfig {
  if (state === 'overwhelmed') return { maxDailyTasks: 4, taskIntensity: 'light', explanationDepth: 'standard', workloadMultiplier: 0.5, uiMessage: "Workload reduced due to cognitive overload." };
  if (state === 'frustrated') return { maxDailyTasks: 6, taskIntensity: 'light', explanationDepth: 'step-by-step', workloadMultiplier: 0.7, uiMessage: "Shifting to step-by-step explanations." };
  if (state === 'focused') return { maxDailyTasks: 10, taskIntensity: 'intense', explanationDepth: 'concise', workloadMultiplier: 1.1, uiMessage: "Momentum is high. Queuing challenging concepts." };
  return BASE_CONFIG;
}

// Overloaded logPulseSignal supporting both old (state) and new (signalType, data) signatures
export async function logPulseSignal(userId: string, signalOrState: string | CognitiveState, data?: Record<string, any>): Promise<void> {
  const supabase = await createClient();
  if (typeof signalOrState === 'string' && data) {
    // New signature: signalType + data
    try {
      await supabase.from('pulse_signals').insert({
        user_id: userId,
        signal_type: signalOrState,
        emotional_state: data.emotionalState || 'neutral',
        notes: JSON.stringify(data),
        created_at: new Date().toISOString(),
      });
    } catch (err) {
      logger.warn('logPulseSignal (type+data) failed', err);
    }
    return;
  }
  // Old signature: state only
  const state = signalOrState as CognitiveState;
  try {
    await supabase.from('pulse_signals').insert({
      user_id: userId,
      signal_type: 'self_report',
      emotional_state: state,
      confidence: 1.0,
    });
    await supabase.from('profiles').update({
      emotional_state: state,
      last_active_at: new Date().toISOString(),
    }).eq('id', userId);
  } catch (err) {
    logger.warn('logPulseSignal (state) failed', err);
  }
}

// New helper to retrieve the current pulse state for a user
export async function getPulseState(userId: string): Promise<CognitiveState> {
  try {
    const result = await detectStudyFriction(userId);
    return result.state;
  } catch {
    return 'neutral';
  }
}



// ==========================================
// Backward Compatibility Aliases for Safety
// ==========================================
export type EmotionalState = CognitiveState;
export type AdaptiveConfig = PulseAdaptationConfig;

export async function detectEmotionalState(userId: string) {
  const result = await detectStudyFriction(userId);
  return { state: result.state, confidence: result.confidence };
}

// Timing hook: Can still be called by UI, but we no longer infer emotional state from it.
export async function recordMessageTiming(
  userId: string,
  responseTimeMs: number,
  messageLength: number,
  isCorrectAnswer: boolean | null
): Promise<void> {
  const supabase = await createClient();
  try {
    // Purely recording behavioral latency telemetry for future analytic dashboards, 
    // no longer using it to hallucinate frustration.
    await supabase.from('pulse_signals').insert({
      user_id: userId,
      signal_type: 'message_timing',
      emotional_state: 'neutral',
      confidence: 1.0,
      interaction_count: messageLength,
      notes: JSON.stringify({ responseTimeMs, isCorrectAnswer })
    });
  } catch (error) {
    logger.warn('Error in recordMessageTiming', error);
  }
}

export async function calculateProductivityFingerprint(userId: string): Promise<{ fatigueThresholdMinutes: number; peakProductivityHour: number }> {
  const supabase = await createClient();

  const { data: sessions } = await supabase
    .from('study_sessions')
    .select('started_at, duration_minutes, focus_score')
    .eq('user_id', userId)
    .not('focus_score', 'is', null)
    .not('duration_minutes', 'is', null);

  let fatigueThresholdMinutes = 45; // Default focus window
  let peakProductivityHour = 10; // Default peak hour (10 AM)

  if (sessions && sessions.length > 0) {
    // 1. Calculate Focus Window (fatigue threshold)
    const highFocusSessions = sessions.filter(s => (s.focus_score || 0) >= 70 && (s.duration_minutes || 0) > 10);
    if (highFocusSessions.length > 0) {
      const totalDuration = highFocusSessions.reduce((acc, s) => acc + (s.duration_minutes || 0), 0);
      fatigueThresholdMinutes = Math.round(totalDuration / highFocusSessions.length);
      // Cap between 25 and 90 minutes
      fatigueThresholdMinutes = Math.max(25, Math.min(90, fatigueThresholdMinutes));
    }

    // 2. Calculate Peak Productivity Hour
    const hourScores: Record<number, { sum: number; count: number }> = {};
    sessions.forEach(s => {
      if (s.started_at && s.focus_score) {
        const hour = new Date(s.started_at).getHours();
        if (!hourScores[hour]) hourScores[hour] = { sum: 0, count: 0 };
        hourScores[hour].sum += s.focus_score;
        hourScores[hour].count += 1;
      }
    });

    let bestHour = 10;
    let highestAvg = 0;
    for (const [hourStr, data] of Object.entries(hourScores)) {
      if (data.count >= 2) {
        const avg = data.sum / data.count;
        if (avg > highestAvg) {
          highestAvg = avg;
          bestHour = parseInt(hourStr, 10);
        }
      }
    }

    if (highestAvg > 0) {
      peakProductivityHour = bestHour;
    }
  }

  const { error } = await supabase.from('student_models')
    .update({
      fatigue_threshold_minutes: fatigueThresholdMinutes,
      peak_productivity_hour: peakProductivityHour,
      last_updated: new Date().toISOString()
    })
    .eq('user_id', userId);

  if (error) {
    logger.error('Failed to update student productivity fingerprint', error);
  }

  return { fatigueThresholdMinutes, peakProductivityHour };
}

// ------------------------------------------------------------------
// CONSUMERS
// ------------------------------------------------------------------

export class PulseConsumer {
  static async handleAutopsyProcessed(userId: string, metadata: any): Promise<void> {
    const data = metadata || {};
    // High incorrect rate → log frustrated/overwhelmed signal
    const total   = data.totalQuestions || 0;
    const wrong   = data.incorrectCount || 0;
    const pct     = total > 0 ? wrong / total : 0;

    const state: CognitiveState =
      pct > 0.6 ? 'overwhelmed' :
      pct > 0.4 ? 'frustrated' :
      'neutral';

    await logPulseSignal(userId, state, {
      source: 'autopsy',
      autopsyId: data.autopsyId,
      incorrectPct: Math.round(pct * 100),
    }).catch(err => logger.warn('PulseConsumer signal log failed', err));
  }
}
