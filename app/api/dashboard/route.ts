import { after, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCognitionGraph } from '@/lib/engines/cognition-graph';
import { getRevisionStats, getDueCards } from '@/lib/engines/revision-engine';
import { getMistakeAnalytics } from '@/lib/engines/mistake-engine';
import { apiErrorResponse, getRequestId, unexpectedApiErrorResponse } from '@/lib/api/errors';
import { EventWorkerService } from '@/lib/events/worker';
import { logger } from '@/lib/utils/logger';
import { loadActiveLearningContext } from '@/lib/learning-context/active-context';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const requestId = getRequestId(request);
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return apiErrorResponse('unauthorized', {
        status: 401,
        message: 'Authentication is required.',
        requestId,
      });
    }

    const localDate = new Date().toISOString().split('T')[0];
    const { searchParams } = new URL(request.url);
    const requestedGoalId = searchParams.get('goalId');
    const activeContext = await loadActiveLearningContext({
      supabase,
      userId: user.id,
      requestedGoalId: requestedGoalId,
      requestId,
    });
    const goalId = activeContext.goalId;
    const activeGoal = activeContext.rawGoal;

    let allCardsQuery = supabase.from('revision_cards')
      .select('id, due, stability, difficulty, state, subject, chapter')
      .eq('user_id', user.id);
    if (goalId) allCardsQuery = allCardsQuery.eq('goal_id', goalId);

    let conceptsQuery = supabase.from('concepts').select('subject, chapter').eq('user_id', user.id);
    if (goalId) conceptsQuery = conceptsQuery.eq('goal_id', goalId);

    let tasksQuery = supabase.from('daily_microtasks')
      .select('id, title, status, subject, topic, estimated_minutes')
      .eq('user_id', user.id)
      .eq('task_date', localDate);
    tasksQuery = goalId
      ? tasksQuery.eq('goal_id', goalId)
      : typeof (tasksQuery as any).is === 'function'
        ? (tasksQuery as any).is('goal_id', null)
        : tasksQuery;

    let latestAssessmentQuery = supabase
      .from('assessments')
      .select('id, title, status, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1);
    if (goalId) latestAssessmentQuery = latestAssessmentQuery.eq('goal_id', goalId);

    let latestReportQuery = supabase
      .from('autopsy_reports')
      .select('id, assessment_id, summary_text, recoverable_marks_estimate, top_patterns, top_topics, status, generated_by, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1);
    if (goalId) latestReportQuery = latestReportQuery.eq('goal_id', goalId);

    let topMemoryQuery = supabase
      .from('amaura_pattern_memories')
      .select('id, pattern_type, subject, topic, pattern, occurrences, severity, confidence, evidence, last_seen_at')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('last_seen_at', { ascending: false })
      .limit(1);
    if (goalId) topMemoryQuery = topMemoryQuery.eq('goal_id', goalId);

    let seededTopicsQuery = supabase
      .from('seeded_topics')
      .select('id, subject, chapter, topic, microtarget, status, order_index, metadata')
      .eq('user_id', user.id)
      .order('order_index', { ascending: true })
      .limit(20);
    
    seededTopicsQuery = goalId 
      ? seededTopicsQuery.eq('goal_id', goalId)
      : typeof (seededTopicsQuery as any).is === 'function'
        ? (seededTopicsQuery as any).is('goal_id', null)
        : seededTopicsQuery;

    let mistakeCountQuery = supabase
      .from('mistake_diagnoses')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'active');
    if (goalId) mistakeCountQuery = mistakeCountQuery.eq('goal_id', goalId);

    let masteryAggQuery = supabase
      .from('concepts')
      .select('mastery_score')
      .eq('user_id', user.id);
    if (goalId) masteryAggQuery = masteryAggQuery.eq('goal_id', goalId);

    let tutorMasteryQuery = supabase
      .from('concept_mastery')
      .select('concept_tag, mastery_score, correct_count, partial_count, incorrect_count, last_practiced_at, last_result')
      .eq('user_id', user.id);
    if (goalId) tutorMasteryQuery = tutorMasteryQuery.eq('goal_id', goalId);

    const [
      profileRes,
      cognition,
      dueRes,
      statsRes,
      allCardsRes,
      mistakeAnalytics,
      conceptsRes,
      tasksRes,
      latestAssessmentRes,
      latestReportRes,
      topMemoryRes,
      seededTopicsRes,
      mistakeCountRes,
      masteryAggRes,
      tutorMasteryRes,
    ] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      getCognitionGraph(user.id, goalId),
      getDueCards(user.id, 75, goalId),
      getRevisionStats(user.id, goalId),
      allCardsQuery,
      getMistakeAnalytics(user.id, goalId),
      conceptsQuery,
      tasksQuery.order('priority', { ascending: true }),
      latestAssessmentQuery.maybeSingle(),
      latestReportQuery.maybeSingle(),
      topMemoryQuery.maybeSingle(),
      seededTopicsQuery,
      mistakeCountQuery.then(res => res.count ?? 0),
      masteryAggQuery,
      tutorMasteryQuery,
    ]);

    let overallMastery = profileRes.data?.overall_mastery ?? 0;
    if (masteryAggRes.data && masteryAggRes.data.length > 0) {
      const sum = masteryAggRes.data.reduce((acc: number, c: any) => acc + Number(c.mastery_score ?? 0), 0);
      overallMastery = Math.round((sum / masteryAggRes.data.length) * 100) / 100;
    }

    const tutorMastery = tutorMasteryRes.data ?? [];
    if (tutorMastery.length > 0) {
      const sum = tutorMastery.reduce((acc: number, item: any) => acc + Number(item.mastery_score ?? 0), 0);
      overallMastery = Math.round((sum / tutorMastery.length) * 100);
    }

    const { getWeakAreasForUser } = await import('@/lib/weak-areas/get-weak-areas');
    const weakData = await getWeakAreasForUser(supabase, { userId: user.id, goalId: goalId || '' });
    const activeWeakAreas = weakData.weakAreas;

    const weakPaths = activeWeakAreas.map((area: any) => area.displayPath.join(' / '));
    const nextRecommendedMicrotarget = weakPaths.length > 0
      ? `Repair ${weakPaths[0]} with active recall.`
      : (seededTopicsRes.data?.find((topic: any) => topic.status === 'active')?.microtarget ?? null);

    const syllabus: Record<string, string[]> = {};
    if (conceptsRes.data) {
      conceptsRes.data.forEach((c: any) => {
        if (!syllabus[c.subject]) syllabus[c.subject] = [];
        if (!syllabus[c.subject].includes(c.chapter)) syllabus[c.subject].push(c.chapter);
      });
    }

    after(() => {
      EventWorkerService.processSafeUserEvents(user.id, 2).catch((error) => {
        logger.warn('Dashboard opportunistic event processing skipped', {
          userId: user.id,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    });

    return NextResponse.json({
      profile: profileRes.data,
      learnerProfile: {
        overallMastery,
        mistakeCount: mistakeCountRes,
        conceptCount: masteryAggRes.data?.length ?? 0,
      },
      activeGoal,
      seededTopics: (seededTopicsRes?.data ?? []).map((t: any) => ({
        id: t.id,
        subject: t.subject,
        chapter: t.chapter,
        topic: t.topic,
        microtarget: t.microtarget,
        status: t.status,
        order_index: t.order_index,
        metadata: t.metadata,
      })),
      learningAdaptation: {
        activeWeakAreas,
        masteryPercentage: overallMastery,
        completedMicrotargets: (seededTopicsRes.data ?? []).filter((topic: any) => ['mastered', 'completed'].includes(topic.status)).length,
        lastPracticedAt: tutorMastery.map((item: any) => item.last_practiced_at).filter(Boolean).sort().at(-1) ?? null,
        nextRecommendedMicrotarget,
      },
      cognition,
      revision: { due: dueRes, stats: statsRes, allCards: allCardsRes.data || [] },
      mistakes: mistakeAnalytics ? { ...mistakeAnalytics, syllabus } : null,
      deepAutopsy: {
        latestAssessment: latestAssessmentRes.data ?? null,
        latestReport: latestReportRes.data ?? null,
        topMemory: topMemoryRes.data ?? null,
      },
      tasks: (tasksRes.data || []).map((t: any) => ({
        id: t.id,
        title: t.title,
        completed: t.status === 'done',
        subject: t.subject,
        chapter: t.topic,
        estimatedMinutes: t.estimated_minutes
      })),
    }, { headers: { 'x-request-id': requestId } });
  } catch (error: any) {
    return unexpectedApiErrorResponse(request, error, 'dashboard', 'Unable to load dashboard data.');
  }
}
