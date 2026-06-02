import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCognitionGraph } from '@/lib/engines/cognition-graph';
import { getRevisionStats, getDueCards } from '@/lib/engines/revision-engine';
import { getMistakeAnalytics } from '@/lib/engines/mistake-engine';
import { apiErrorResponse, getRequestId, unexpectedApiErrorResponse } from '@/lib/api/errors';

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

    const [
      profileRes,
      cognition,
      dueRes,
      statsRes,
      allCardsRes,
      mistakeAnalytics,
      conceptsRes,
      tasksRes
    ] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      getCognitionGraph(user.id),
      getDueCards(user.id),
      getRevisionStats(user.id),
      supabase.from('revision_cards')
        .select('id, due, stability, difficulty, state, subject, chapter')
        .eq('user_id', user.id),
      getMistakeAnalytics(user.id),
      supabase.from('concepts').select('subject, chapter').eq('user_id', user.id),
      supabase.from('daily_microtasks')
        .select('id, title, status, subject, topic, estimated_minutes')
        .eq('user_id', user.id)
        .eq('task_date', localDate)
        .order('priority', { ascending: true })
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
      cognition,
      revision: { due: dueRes, stats: statsRes, allCards: allCardsRes.data || [] },
      mistakes: mistakeAnalytics ? { ...mistakeAnalytics, syllabus } : null,
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
