import { createClient } from '@/lib/supabase/server';
import { getPrerequisiteChain } from './cognition-graph';
import { searchPersonalKnowledge } from './rag-engine';
import { logger } from '@/lib/utils/logger';
import { getEmbedding } from '@/lib/ai/gemini';

export interface MindContext {
  profile: {
    fullName: string;
    examType: string;
    examDate: string;
    streakDays: number;
    emotionalState: string;
  };
  goal: {
    title: string;
    description: string | null;
    targetCompletionDate: string | null;
    currentLevel: string;
    preferredLearningStyle: string;
    dailyHoursAvailable: number;
    progressPercentage: number;
    totalConcepts: number;
    masteredConcepts: number;
  } | null;
  weakConcepts: Array<{
    name: string;
    subject: string;
    chapter: string;
    mastery: string;
    unmasteredPrereqs: string[];
  }>;
  struggles: Array<{
    subject: string;
    chapter: string;
    topic: string | null;
    category: string;
    questionText: string | null;
    userAnswer: string | null;
    correctAnswer: string | null;
    aiAnalysis: string | null;
    marksLost: number;
  }>;
  sessionHistory: Array<{
    date: string;
    conceptName: string;
    summary: string;
  }>;
  ragNotes: Array<{
    title: string;
    chunkText: string;
  }>;
  salientMemories: Array<{
    type: string;
    description: string;
    createdAt: string;
  }>;
}

export async function getMINDContext(userId: string, userQuery: string): Promise<MindContext> {
  const supabase = await createClient();

  // 1. Fetch Profile
  const { data: profileData } = await supabase
    .from('profiles')
    .select('full_name, exam_type, exam_date, streak_days, emotional_state')
    .eq('id', userId)
    .single();

  const profile = {
    fullName: profileData?.full_name || 'Student',
    examType: profileData?.exam_type || 'General Study',
    examDate: profileData?.exam_date ? new Date(profileData.exam_date).toISOString().split('T')[0] : 'Not set',
    streakDays: profileData?.streak_days || 0,
    emotionalState: profileData?.emotional_state || 'neutral',
  };

  // 2. Fetch Active Goal
  const { data: goalData } = await supabase
    .from('learning_goals')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let goal: MindContext['goal'] = null;
  let goalConcepts: any[] = [];

  if (goalData) {
    // Fetch concepts for this user to compute progress
    const { data: allConcepts } = await supabase
      .from('concepts')
      .select('*')
      .eq('user_id', userId);

    if (allConcepts) {
      // Filter by goal_id if set, otherwise fallback to concepts matching subject/chapter context
      const filtered = allConcepts.filter(c => c.goal_id === goalData.id);
      goalConcepts = filtered.length > 0 ? filtered : allConcepts;
    }

    const totalConcepts = goalConcepts.length;
    const masteredConcepts = goalConcepts.filter(c => ['mastered', 'automated'].includes(c.mastery)).length;
    const progressPercentage = totalConcepts > 0 ? Math.round((masteredConcepts / totalConcepts) * 100) : 0;

    goal = {
      title: goalData.title,
      description: goalData.description,
      targetCompletionDate: goalData.target_completion_date ? new Date(goalData.target_completion_date).toISOString().split('T')[0] : null,
      currentLevel: goalData.current_level || 'beginner',
      preferredLearningStyle: goalData.preferred_learning_style || 'read_write',
      dailyHoursAvailable: goalData.daily_hours_available || 8,
      progressPercentage,
      totalConcepts,
      masteredConcepts,
    };
  } else {
    // Fallback: If no active goal, just pull concepts for general context
    const { data: allConcepts } = await supabase
      .from('concepts')
      .select('*')
      .eq('user_id', userId);
    goalConcepts = allConcepts || [];
  }

  // 3. Weak Concepts & Prerequisite Chain
  const weakFiltered = goalConcepts
    .filter(c => ['not_started', 'exposed', 'developing'].includes(c.mastery))
    .slice(0, 8);

  const weakConcepts = await Promise.all(
    weakFiltered.map(async (c) => {
      let unmasteredPrereqs: string[] = [];
      try {
        const prereqs = await getPrerequisiteChain(c.id);
        unmasteredPrereqs = prereqs.map((p: any) => p.name);
      } catch (err) {
        logger.error(`Error resolving prereqs for concept ${c.id}`, err);
      }

      return {
        name: c.name,
        subject: c.subject,
        chapter: c.chapter,
        mastery: c.mastery,
        unmasteredPrereqs,
      };
    })
  );

  // 4. Mistakes (Previous Struggles)
  const { data: mistakesData } = await supabase
    .from('mistakes')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(5);

  const struggles = (mistakesData || []).map(m => ({
    subject: m.subject,
    chapter: m.chapter,
    topic: m.topic || null,
    category: m.category,
    questionText: m.question_text || null,
    userAnswer: m.user_answer || null,
    correctAnswer: m.correct_answer || null,
    aiAnalysis: m.ai_analysis || null,
    marksLost: m.marks_lost || 0,
  }));

  // 5. Socratic Sessions Memory (Learning History)
  const { data: sessionsData } = await supabase
    .from('tutor_sessions')
    .select('started_at, summary, concept_id')
    .eq('user_id', userId)
    .not('summary', 'is', null)
    .order('started_at', { ascending: false })
    .limit(4);

  const conceptIds = sessionsData?.map(s => s.concept_id).filter(Boolean) || [];
  let conceptNameMap: Record<string, string> = {};
  if (conceptIds.length > 0) {
    const { data: conceptsList } = await supabase
      .from('concepts')
      .select('id, name')
      .in('id', conceptIds);
    conceptsList?.forEach(c => {
      conceptNameMap[c.id] = c.name;
    });
  }

  const sessionHistory = (sessionsData || []).map(s => ({
    date: s.started_at ? new Date(s.started_at).toLocaleDateString() : 'Recent',
    conceptName: s.concept_id ? (conceptNameMap[s.concept_id] || 'Target Concept') : 'General Study',
    summary: s.summary || '',
  }));

  // 6. RAG Document Retrieval (Uploaded Materials)
  let ragNotes: MindContext['ragNotes'] = [];
  if (userQuery.trim().length > 3) {
    try {
      const chunks = await searchPersonalKnowledge(userId, userQuery, 0.35, 4);
      if (chunks && chunks.length > 0) {
        // Fetch material titles for reference mapping
        const materialIds = Array.from(new Set(chunks.map((c: any) => c.material_id).filter(Boolean)));
        let materialTitleMap: Record<string, string> = {};

        if (materialIds.length > 0) {
          const { data: mats } = await supabase
            .from('materials')
            .select('id, title')
            .in('id', materialIds);
          mats?.forEach(m => {
            materialTitleMap[m.id] = m.title;
          });
        }

        ragNotes = chunks.map((c: any) => ({
          title: materialTitleMap[c.material_id] || 'Uploaded Note',
          chunkText: c.chunk_text || '',
        }));
      }
    } catch (err) {
      logger.error('RAG retrieval failed in mind-engine', err);
    }
  }

  // 7. Salient Episodic Memories (Soul Layer)
  let salientMemories: MindContext['salientMemories'] = [];
  try {
    const queryEmbedding = await getEmbedding(userQuery);
    const { data: memories } = await supabase.rpc('get_salient_memories', {
      p_user_id: userId,
      p_query_embedding: queryEmbedding,
      p_pulse_state: profile.emotionalState,
      p_limit: 2
    });

    if (memories && memories.length > 0) {
      salientMemories = memories.map((m: any) => ({
        type: m.type,
        description: m.description,
        createdAt: m.created_at,
      }));
    }
  } catch (err) {
    logger.error('Failed to fetch salient memories in mind-engine', err);
    // Non-blocking: continue without memories if RPC fails
  }

  return {
    profile,
    goal,
    weakConcepts,
    struggles,
    sessionHistory,
    ragNotes,
    salientMemories,
  };
}
