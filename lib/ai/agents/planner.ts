import { createClient } from '@/lib/supabase/server';
import { budgetedGenerateJSON, budgetedGenerateText } from '@/lib/ai/budgeted';
import { z } from 'zod';
import { getExamConfig } from '@/lib/utils/constants';
import { DailyMissionSchema, MissionTaskSchema } from '@/lib/engines/planner-schemas';
import { logger } from '@/lib/utils/logger';
import { EpisodicMemoryService } from '@/lib/services/episodic-memory.service';
import { registerPromptAudit, reserveBudgetForModelCall } from '@/lib/ai/cost-guard';
import { getPromptVersion } from '@/lib/ai/prompt-version';

type MissionTask = z.infer<typeof MissionTaskSchema>;

export async function generateDailyPlan(userId: string, date: string) {
  const supabase = await createClient();

  // 1. Fetch Deep Telemetry
  // We use parallel fetching to gather the entire cognitive & behavioral state
  const [
    profileRes, conceptsRes, currentTasksRes, mistakesRes, 
    dueCardsRes, snapshotsRes, unfinishedTasksRes, studentModelRes
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).single(),
    supabase.from('concepts').select('subject, chapter, mastery, forgetting_probability').eq('user_id', userId).in('mastery', ['not_started', 'exposed', 'developing']),
    supabase.from('study_tasks').select('*').eq('user_id', userId).eq('scheduled_date', date),
    supabase.from('mistakes').select('subject, chapter, category, marks_lost').eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
    supabase.from('revision_cards').select('id').eq('user_id', userId).lte('due', new Date().toISOString()),
    supabase.from('performance_snapshots').select('metrics').eq('user_id', userId).order('snapshot_date', { ascending: false }).limit(3),
    
    // Fetch carryover tasks from the last 3 days
    supabase.from('study_tasks').select('title, subject, chapter, type').eq('user_id', userId).eq('is_completed', false)
      .gte('scheduled_date', new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .lt('scheduled_date', date),
    supabase.from('student_models').select('fatigue_threshold_minutes, peak_productivity_hour').eq('user_id', userId).maybeSingle()
  ]);

  const existingTasks = currentTasksRes.data || [];
  if (existingTasks.length > 0) return existingTasks; // Do not overwrite existing plan

  // 2. Pre-process Data for LLM Context
  const profile = profileRes.data;
  const examType = profile?.exam_type || 'General Study';
  const { getUserSyllabus } = await import('@/lib/engines/atlas-expansion');
  const userSyllabus = await getUserSyllabus(userId, examType);
  const subjects = userSyllabus.subjects.join(', ');

  const studentModel: any = studentModelRes.data || {};
  const focusWindow = studentModel.fatigue_threshold_minutes || 45;
  const peakHour = studentModel.peak_productivity_hour || 10;

  const weakConcepts = (conceptsRes.data || []).sort((a, b) => (b.forgetting_probability || 0) - (a.forgetting_probability || 0)).slice(0, 10);
  const recentMistakes = mistakesRes.data || [];
  const unfinishedTasks = unfinishedTasksRes.data || [];
  const dueRevisionCount = dueCardsRes.data?.length || 0;
  
  // Calculate average recent focus to determine learning velocity
  const snapshots = snapshotsRes.data || [];
  const avgFocus = snapshots.length > 0 ? snapshots.reduce((s, snap) => s + (snap.metrics?.focus_score || 50), 0) / snapshots.length : 50;

  // Adaptive Workload Calculation
  let baseHours = profile?.daily_hours || 8;
  const emotionalState = profile?.emotional_state || 'neutral';
  if (['burnt_out', 'overwhelmed'].includes(emotionalState)) baseHours = Math.max(2, baseHours * 0.4);
  else if (['stressed', 'anxious'].includes(emotionalState)) baseHours = Math.max(4, baseHours * 0.7);
  else if (['motivated', 'focused'].includes(emotionalState)) baseHours = Math.min(12, baseHours * 1.2);

  // 3. Construct Mission Prompt
  const prompt = `
    You are the closed-beta daily mission planner for ${examType}.
    Generate today's highly optimized study mission.

    ## STUDENT TELEMETRY
    - Date: ${date}
    - Target Exam: ${examType} (Subjects: ${subjects})
    - Emotional State: ${emotionalState}
    - Adaptive Time Cap: ${baseHours.toFixed(1)} hours maximum
    - Recent Focus Score: ${avgFocus.toFixed(0)}/100
    - FSRS Due Cards: ${dueRevisionCount} (If > 0, scheduling a "revision" block is CRITICAL)
    - Focus Window Length (Fatigue Threshold): ${focusWindow} minutes
    - Peak Productivity Hour: ${peakHour}:00

    ## PRIORITY 1: Carryover Tasks (Unfinished)
    ${unfinishedTasks.length > 0 ? unfinishedTasks.map(t => `- [${t.type}] ${t.subject}: ${t.chapter} (${t.title})`).join('\n') : 'None.'}

    ## PRIORITY 2: High ROI Mistake Fixes
    ${recentMistakes.map(m => `- ${m.subject} > ${m.chapter}: ${m.category} (-${m.marks_lost} marks)`).join('\n')}

    ## PRIORITY 3: High Forgetting Risk (Weak Concepts)
    ${weakConcepts.map(c => `- ${c.subject} > ${c.chapter} (Forgetting Risk: ${Math.round(c.forgetting_probability * 100)}%)`).join('\n')}

    ## MISSION RULES
    1. STRICT TIME LIMIT: Total "estimated_minutes" across all tasks MUST NOT exceed ${Math.floor(baseHours * 60)} minutes.
    2. BLOCK STRUCTURE: Do not schedule single tasks longer than the student's Focus Window Length (${focusWindow} minutes). Use breaks in between.
    3. EXPLAINABILITY: Every task MUST have a "rationale" explaining why you chose it based on the telemetry above.
    4. BREAKS: Schedule "break" type tasks explicitly between intense study blocks. Generate a "breakRecommendation" for the overall day.
    5. Prioritize FSRS Revision if Due Cards > 0.
    6. TIME SLOTS: Assign each task a "scheduled_start_time" in "HH:mm" 24hr format. Start from 08:00 and align high priority (critical/high) tasks as close to the Peak Productivity Hour (${peakHour}:00) as possible without breaking sequence.
  
  `;

  // 4. Generate & Parse (Using Robust Safe Zod Wrapper)
  logger.info(`Generating Daily Mission`, { userId, date, baseHours, emotionalState });
  
  const planReservation = await reserveBudgetForModelCall(
    userId,
    'planner',
    'router:daily-plan',
    Math.max(1, Math.ceil(prompt.length / 4)),
    1200
  );
  registerPromptAudit(planReservation.reservationId, {
    userId,
    promptVersion: getPromptVersion('command'),
    promptFamily: 'command_plan',
    promptSource: 'generateDailyPlan',
    route: 'planner:daily-plan',
  });
  const mission = await budgetedGenerateJSON<z.infer<typeof DailyMissionSchema>>({
    userId,
    feature: 'planner',
    route: 'planner:daily-plan',
    model: 'flash',
    systemPrompt: 'You are an elite academic operations director.',
    userPrompt: prompt,
    schema: DailyMissionSchema,
    maxOutputTokens: 1200
  });

  let finalTasks: MissionTask[] = [];
  const missionData = mission as any;

  if (missionData && missionData.tasks && missionData.tasks.length > 0) {
    finalTasks = missionData.tasks;
    
    // Add the AI's overall break recommendation as a final wrap-up task if needed
    if (missionData.breakRecommendation) {
      finalTasks.push({
        title: "Daily Debrief & Recovery",
        description: missionData.breakRecommendation,
        type: "break",
        subject: null,
        chapter: null,
        priority: "low",
        estimated_minutes: 15,
        rationale: "End-of-day cognitive down-regulation."
      });
    }
  } else {
    // 5. Fallback Heuristic Generator (Zero-Downtime Guarantee)
    logger.warn('AI Mission Generation Failed. Utilizing Heuristic Fallback Planner.', { userId });
    
    finalTasks = [];
    let currentMinutes = 8 * 60; // Start at 08:00
    const formatTime = (mins: number) => {
      const h = Math.floor(mins / 60) % 24;
      const m = mins % 60;
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };

    if (dueRevisionCount > 0) {
      finalTasks.push({ 
        title: "FSRS Spaced Repetition", 
        description: `Clear ${dueRevisionCount} due cards`, 
        type: "revision", 
        priority: "critical", 
        estimated_minutes: Math.min(30, focusWindow), 
        rationale: "Algorithm detected forgetting curve decay.",
        scheduled_start_time: formatTime(currentMinutes)
      });
      currentMinutes += Math.min(30, focusWindow);
    }
    if (unfinishedTasks.length > 0) {
      const t = unfinishedTasks[0];
      finalTasks.push({ 
        title: `Complete: ${t.title}`, 
        description: "Carryover from yesterday", 
        type: (t.type || "study") as any, 
        subject: t.subject, 
        chapter: t.chapter, 
        priority: "high", 
        estimated_minutes: focusWindow, 
        rationale: "Maintaining syllabus momentum.",
        scheduled_start_time: formatTime(currentMinutes)
      });
      currentMinutes += focusWindow;
    }
    if (weakConcepts.length > 0) {
      const c = weakConcepts[0];
      finalTasks.push({ 
        title: `Mastery Block: ${c.chapter}`, 
        description: "Focus on weakest area", 
        type: "study", 
        subject: c.subject, 
        chapter: c.chapter, 
        priority: "high", 
        estimated_minutes: focusWindow, 
        rationale: `High forgetting probability detected (${Math.round(c.forgetting_probability * 100)}%).`,
        scheduled_start_time: formatTime(currentMinutes)
      });
      currentMinutes += focusWindow;
    }
    finalTasks.push({ 
      title: "Strategic Rest", 
      description: "Hydrate and detach", 
      type: "break", 
      priority: "medium", 
      estimated_minutes: 15, 
      rationale: "Cognitive reset required to maintain accuracy.",
      scheduled_start_time: formatTime(currentMinutes)
    });
  }

  // 6. Persist to Database
  const rows = finalTasks.map((t: MissionTask) => ({
    user_id: userId,
    title: t.title,
    description: t.description || '',
    type: t.type || 'study',
    subject: t.subject || null,
    chapter: t.chapter || null,
    priority: t.priority || 'medium',
    estimated_minutes: t.estimated_minutes || 45,
    scheduled_date: date,
    scheduled_start_time: t.scheduled_start_time || null,
    is_completed: false,
    notes: t.rationale || 'System generated priority.', // Map rationale to notes
  }));

  const { data, error } = await supabase.from('study_tasks').insert(rows).select();
  
  if (error) {
    logger.error('Failed to save mission tasks to DB', error);
    throw new Error('Failed to save daily mission.');
  }
  
  return data || [];
}

// AI-powered daily morning briefing narrative generator
export async function generateMorningBriefing(userId: string) {
  const supabase = await createClient();
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('exam_type, target_date, streak_days, daily_hours, emotional_state')
    .eq('id', userId)
    .single();

  const examDate = profile?.target_date ? new Date(profile.target_date) : new Date(`${new Date().getFullYear() + 1}-05-01T00:00:00Z`);
  const daysRemaining = Math.max(0, Math.ceil((examDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

  // Yesterday's task completion
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const { data: yesterdayTasks } = await supabase
    .from('study_tasks')
    .select('is_completed')
    .eq('user_id', userId)
    .eq('scheduled_date', yesterday);
    
  let completionRate = 0;
  if (yesterdayTasks && yesterdayTasks.length > 0) {
    const completed = yesterdayTasks.filter(t => t.is_completed).length;
    completionRate = Math.round((completed / yesterdayTasks.length) * 100);
  }

  // Emotional state from profile
  const emotionalState = profile?.emotional_state || 'neutral';

  // FSRS due cards
  const { getDueCards } = await import('@/lib/engines/revision-engine');
  const dueCards = (await getDueCards(userId, 50)).length;

  // Top weak area
  const { data: weakConcepts } = await supabase
    .from('concepts')
    .select('subject, chapter')
    .eq('user_id', userId)
    .in('mastery', ['exposed', 'developing'])
    .order('forgetting_probability', { ascending: false })
    .limit(1);
    
  const topWeakArea = weakConcepts && weakConcepts.length > 0
    ? `${weakConcepts[0].subject} (${weakConcepts[0].chapter})`
    : 'None detected';
  const relevantEpisodes = await new EpisodicMemoryService()
    .retrieveRelevant(userId, topWeakArea === 'None detected' ? 'study struggle' : topWeakArea, 1)
    .catch(() => [] as string[]);
  const specificCallback = relevantEpisodes[0] || null;

  // Dynamic hours recommended
  let recommendedHours = profile?.daily_hours || 8;
  if (['burnt_out', 'overwhelmed'].includes(emotionalState)) recommendedHours = Math.max(2, recommendedHours * 0.4);
  else if (['stressed', 'anxious'].includes(emotionalState)) recommendedHours = Math.max(4, recommendedHours * 0.7);
  else if (['motivated', 'focused'].includes(emotionalState)) recommendedHours = Math.min(12, recommendedHours * 1.2);

  // Fetch today's top priority task
  const today = new Date().toISOString().split('T')[0];
  const { data: todayTasks } = await supabase
    .from('study_tasks')
    .select('title, notes, priority')
    .eq('user_id', userId)
    .eq('scheduled_date', today)
    .order('priority', { ascending: false })
    .limit(1);

  const topTask = todayTasks && todayTasks.length > 0 ? todayTasks[0] : null;

  const prompt = `
Generate the Morning Briefing narrative for this student.

CONTEXT:
Days to exam: ${daysRemaining}
Yesterday's completion: ${completionRate}%
Cognitive state: ${emotionalState}
Top Priority Task: ${topTask ? topTask.title + ' (' + (topTask.notes || 'System priority') + ')' : 'None scheduled'}
Specific past conversation to reference if relevant: ${specificCallback || 'None available. Do not invent one.'}

RULES:
1. Be direct, authoritative, and grounding.
2. If state is 'overwhelmed', explicitly tell them you have reduced their workload today to protect their retention. 
3. If they missed yesterday's tasks, DO NOT guilt trip them. Reframe today as a blank slate.
4. Point them immediately to their Top Priority Task.
5. Include at most one callback to a specific past conversation, and only if it is listed above.

GOOD EXAMPLE (Overwhelmed): "Telemetry shows your cognitive load was peaking yesterday. I've slashed today's workload by 40% and removed all new concepts. We are only doing maintenance. Your only required mission today is a 20-minute FSRS revision block."
GOOD EXAMPLE (Momentum): "You're on a 5-day streak and your focus score is in the 90th percentile. This is when we attack the hard stuff. I've queued the rotational mechanics autopsies you failed last week. Let's reclaim those 12 marks."
`;
  
  const reservation = await reserveBudgetForModelCall(
    userId,
    'planner',
    'router:daily-briefing',
    Math.max(1, Math.ceil(prompt.length / 4)),
    500
  );
  registerPromptAudit(reservation.reservationId, {
    userId,
    promptVersion: getPromptVersion('briefing'),
    promptFamily: 'morning_briefing',
    promptSource: 'generateMorningBriefing',
    route: 'planner:morning-briefing',
  });
  return budgetedGenerateText({
    userId,
    feature: 'planner',
    route: 'planner:morning-briefing',
    model: 'flash',
    systemPrompt: 'You are the daily mission planner.',
    userPrompt: prompt,
    maxOutputTokens: 500
  });
}
