import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCognitionGraph } from '@/lib/engines/cognition-graph';
import { getRevisionStats, getDueCards } from '@/lib/engines/revision-engine';
import { getMistakeAnalytics } from '@/lib/engines/mistake-engine';
import { apiErrorResponse, getRequestId, unexpectedApiErrorResponse } from '@/lib/api/errors';
import { ensureGoalForUser } from '@/lib/services/goal-context.service';

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
    const goalId = searchParams.get('goalId');
    const activeGoal = goalId ? await ensureGoalForUser(supabase, user.id, goalId) : null;

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
      .from('hermes_learning_memories')
      .select('id, memory_type, subject, topic, pattern, evidence_count, severity, confidence, prevention_rule, last_seen_at')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('last_seen_at', { ascending: false })
      .limit(1);
    if (goalId) topMemoryQuery = topMemoryQuery.eq('goal_id', goalId);

    let seededTopicsQuery = supabase
      .from('seeded_topics')
      .select('id, subject, chapter, topic, microtarget, status, order_index')
      .eq('user_id', user.id)
      .order('order_index', { ascending: true })
      .limit(20);
    if (goalId) seededTopicsQuery = seededTopicsQuery.eq('goal_id', goalId);

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
    ]);

    const syllabus: Record<string, string[]> = {};
    if (conceptsRes.data) {
      conceptsRes.data.forEach((c: any) => {
        if (!syllabus[c.subject]) syllabus[c.subject] = [];
        if (!syllabus[c.subject].includes(c.chapter)) syllabus[c.subject].push(c.chapter);
      });
    }

    return NextResponse.json({
      profile: profileRes.data,
      activeGoal,
      seededTopics: seededTopicsRes?.data ?? [],
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
