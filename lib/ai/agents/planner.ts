import { createClient } from '@/lib/supabase/server';
import { generateJSON } from '@/lib/ai/gemini';
import { z } from 'zod';
import { getExamConfig } from '@/lib/utils/constants';
import { DailyMissionSchema, MissionTaskSchema } from '@/lib/engines/planner-schemas';
import { logger } from '@/lib/utils/logger';

type MissionTask = z.infer<typeof MissionTaskSchema>;

export async function generateDailyPlan(userId: string, date: string) {
  const supabase = await createClient();

  // 1. Fetch Deep Telemetry
  // We use parallel fetching to gather the entire cognitive & behavioral state
  const [
    profileRes, conceptsRes, currentTasksRes, mistakesRes, 
    dueCardsRes, snapshotsRes, unfinishedTasksRes
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).single(),
    supabase.from('concepts').select('subject, chapter, mastery, forgetting_probability').eq('user_id', userId).in('mastery', ['not_started', 'exposed', 'developing']),
    supabase.from('study_tasks').select('*').eq('user_id', userId).eq('scheduled_date', date),
    supabase.from('mistakes').select('subject, chapter, category, marks_lost').eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
    supabase.from('revision_cards').select('id').eq('user_id', userId).lte('due', new Date().toISOString()),
    supabase.from('performance_snapshots').select('accuracy, focus_score').eq('user_id', userId).order('date', { ascending: false }).limit(3),
    
    // Fetch carryover tasks from the last 3 days
    supabase.from('study_tasks').select('title, subject, chapter, type').eq('user_id', userId).eq('is_completed', false)
      .gte('scheduled_date', new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .lt('scheduled_date', date)
  ]);

  const existingTasks = currentTasksRes.data || [];
  if (existingTasks.length > 0) return existingTasks; // Do not overwrite existing plan

  // 2. Pre-process Data for LLM Context
  const profile = profileRes.data;
  const examType = profile?.exam_type || 'General Study';
  const { getUserSyllabus } = await import('@/lib/engines/atlas-expansion');
  const userSyllabus = await getUserSyllabus(userId, examType);
  const subjects = userSyllabus.subjects.join(', ');

  const weakConcepts = (conceptsRes.data || []).sort((a, b) => (b.forgetting_probability || 0) - (a.forgetting_probability || 0)).slice(0, 10);
  const recentMistakes = mistakesRes.data || [];
  const unfinishedTasks = unfinishedTasksRes.data || [];
  const dueRevisionCount = dueCardsRes.data?.length || 0;
  
  // Calculate average recent focus to determine learning velocity
  const snapshots = snapshotsRes.data || [];
  const avgFocus = snapshots.length > 0 ? snapshots.reduce((s, snap) => s + (snap.focus_score || 50), 0) / snapshots.length : 50;

  // Adaptive Workload Calculation
  let baseHours = profile?.study_hours_per_day || 8;
  const emotionalState = profile?.emotional_state || 'neutral';
  if (['burnt_out', 'overwhelmed'].includes(emotionalState)) baseHours = Math.max(2, baseHours * 0.4);
  else if (['stressed', 'anxious'].includes(emotionalState)) baseHours = Math.max(4, baseHours * 0.7);
  else if (['motivated', 'focused'].includes(emotionalState)) baseHours = Math.min(12, baseHours * 1.2);

  // 3. Construct Mission Prompt
  const prompt = `
    You are COMMAND, the elite AI mission planner for ${examType}.
    Generate today's highly optimized study mission.

    ## STUDENT TELEMETRY
    - Date: ${date}
    - Target Exam: ${examType} (Subjects: ${subjects})
    - Emotional State: ${emotionalState}
    - Adaptive Time Cap: ${baseHours.toFixed(1)} hours maximum
    - Recent Focus Score: ${avgFocus.toFixed(0)}/100
    - FSRS Due Cards: ${dueRevisionCount} (If > 0, scheduling a "revision" block is CRITICAL)

    ## PRIORITY 1: Carryover Tasks (Unfinished)
    ${unfinishedTasks.length > 0 ? unfinishedTasks.map(t => `- [${t.type}] ${t.subject}: ${t.chapter} (${t.title})`).join('\n') : 'None.'}

    ## PRIORITY 2: High ROI Mistake Fixes
    ${recentMistakes.map(m => `- ${m.subject} > ${m.chapter}: ${m.category} (-${m.marks_lost} marks)`).join('\n')}

    ## PRIORITY 3: High Forgetting Risk (Weak Concepts)
    ${weakConcepts.map(c => `- ${c.subject} > ${c.chapter} (Forgetting Risk: ${Math.round(c.forgetting_probability * 100)}%)`).join('\n')}

    ## MISSION RULES
    1. STRICT TIME LIMIT: Total "estimated_minutes" across all tasks MUST NOT exceed ${Math.floor(baseHours * 60)} minutes.
    2. BLOCK STRUCTURE: Use 45-60 min blocks. 
    3. EXPLAINABILITY: Every task MUST have a "rationale" explaining why you chose it based on the telemetry above.
    4. BREAKS: Schedule "break" type tasks explicitly between intense study blocks. Generate a "breakRecommendation" for the overall day.
    5. Prioritize FSRS Revision if Due Cards > 0.
    6. TIME SLOTS: Assign each task a "scheduled_start_time" in "HH:mm" 24hr format. Start from "08:00" and schedule sequentially based on task estimated_minutes and breaks (e.g. Task 1 starts at 08:00 for 60m, next break starts at 09:00 for 15m, next study starts at 09:15).
  
  `;

  // 4. Generate & Parse (Using Robust Safe Zod Wrapper)
  logger.info(`Generating Daily Mission`, { userId, date, baseHours, emotionalState });
  
  const mission = await generateJSON('pro', 'You are an elite academic operations director.', prompt, DailyMissionSchema);

  let finalTasks: MissionTask[] = [];

  if (mission && mission.tasks && mission.tasks.length > 0) {
    finalTasks = mission.tasks;
    
    // Add the AI's overall break recommendation as a final wrap-up task if needed
    if (mission.breakRecommendation) {
      finalTasks.push({
        title: "Daily Debrief & Recovery",
        description: mission.breakRecommendation,
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
        estimated_minutes: 30, 
        rationale: "Algorithm detected forgetting curve decay.",
        scheduled_start_time: formatTime(currentMinutes)
      });
      currentMinutes += 30;
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
        estimated_minutes: 60, 
        rationale: "Maintaining syllabus momentum.",
        scheduled_start_time: formatTime(currentMinutes)
      });
      currentMinutes += 60;
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
        estimated_minutes: 60, 
        rationale: `High forgetting probability detected (${Math.round(c.forgetting_probability * 100)}%).`,
        scheduled_start_time: formatTime(currentMinutes)
      });
      currentMinutes += 60;
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
    .select('exam_type, target_year, exam_date, streak_days, study_hours_per_day, emotional_state')
    .eq('id', userId)
    .single();

  const targetYear = profile?.target_year || new Date().getFullYear() + 1;
  const examDate = profile?.exam_date ? new Date(profile.exam_date) : new Date(`${targetYear}-05-01T00:00:00Z`);
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

  // PULSE emotional state
  const { detectEmotionalState } = await import('@/lib/engines/pulse-engine');
  const { state: emotionalState } = await detectEmotionalState(userId);

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

  // Dynamic hours recommended
  let recommendedHours = profile?.study_hours_per_day || 8;
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

RULES:
1. Be direct, authoritative, and grounding.
2. If state is 'overwhelmed', explicitly tell them you have reduced their workload today to protect their retention. 
3. If they missed yesterday's tasks, DO NOT guilt trip them. Reframe today as a blank slate.
4. Point them immediately to their Top Priority Task.

GOOD EXAMPLE (Overwhelmed): "Telemetry shows your cognitive load was peaking yesterday. I've slashed today's workload by 40% and removed all new concepts. We are only doing maintenance. Your only required mission today is a 20-minute FSRS revision block."
GOOD EXAMPLE (Momentum): "You're on a 5-day streak and your focus score is in the 90th percentile. This is when we attack the hard stuff. I've queued the rotational mechanics autopsies you failed last week. Let's reclaim those 12 marks."
`;
  
  const { generateText } = await import('@/lib/ai/gemini');
  return generateText('flash', 'You are COMMAND, the daily mission AI.', prompt);
}

