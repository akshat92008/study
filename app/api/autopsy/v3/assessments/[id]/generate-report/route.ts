import { NextRequest } from 'next/server';
import { apiErrorResponse, getRequestId, unexpectedApiErrorResponse } from '@/lib/api/errors';
import { EventDispatcher } from '@/lib/events/orchestrator';
import { generateDeterministicAutopsyReport } from '@/lib/autopsy-v3/report-generator';
import { writeHermesMemories } from '@/lib/autopsy-v3/hermes-memory-writer';
import { enforceDailyTableCap, jsonWithRequestId, requireAutopsyV3User } from '@/lib/autopsy-v3/permissions';
import { ingestLearningSignals } from '@/lib/learning-signals/ingest';

type RouteContext = { params: Promise<{ id: string }> | { id: string } };

export async function POST(req: NextRequest, context: RouteContext) {
  const requestId = getRequestId(req);
  try {
    const auth = await requireAutopsyV3User(requestId);
    if (auth.error) return auth.error;
    const { supabase, user, limits } = auth;
    const { id: assessmentId } = await context.params;

    const cap = await enforceDailyTableCap({
      supabase,
      userId: user.id,
      table: 'autopsy_reports',
      limit: limits.dailyReportsPerUser,
      requestId,
      message: `You can generate ${limits.dailyReportsPerUser} Deep Autopsy reports per day.`,
      extra: (query) => query.neq('assessment_id', assessmentId),
    });
    if (cap) return cap;

    const { data: assessment, error: assessmentError } = await supabase
      .from('assessments')
      .select('*')
      .eq('id', assessmentId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (assessmentError) throw assessmentError;
    if (!assessment) {
      return apiErrorResponse('not_found', { status: 404, message: 'Assessment not found.', requestId });
    }

    const [questionsRes, diagnosesRes, memoriesRes] = await Promise.all([
      supabase
        .from('assessment_questions')
        .select('*')
        .eq('assessment_id', assessmentId)
        .eq('user_id', user.id)
        .order('question_number', { ascending: true }),
      supabase
        .from('mistake_diagnoses')
        .select('*')
        .eq('assessment_id', assessmentId)
        .eq('user_id', user.id),
      supabase
        .from('hermes_learning_memories')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .limit(50),
    ]);
    if (questionsRes.error) throw questionsRes.error;
    if (diagnosesRes.error) throw diagnosesRes.error;
    if (memoriesRes.error) throw memoriesRes.error;

    const questions = questionsRes.data ?? [];
    if (questions.length === 0) {
      return apiErrorResponse('questions_required', {
        status: 400,
        message: 'Add at least one question before generating a Deep Autopsy report.',
        requestId,
      });
    }

    const diagnoses = diagnosesRes.data ?? [];
    const report = generateDeterministicAutopsyReport({
      assessment: assessment as any,
      questions: questions as any,
      diagnoses: diagnoses as any,
      priorMemories: (memoriesRes.data ?? []) as any,
    });

    let memoryRows: any[] = [];
    let status: 'ready' | 'fallback_used' = 'ready';
    if (limits.hermesEnabled) {
      try {
        memoryRows = await writeHermesMemories({
          supabase,
          userId: user.id,
          goalId: assessment.goal_id,
          assessmentId,
          report,
          maxWrites: limits.maxMemoryWritesPerReport,
        });
      } catch {
        status = 'fallback_used';
      }
    }

    const { data: persistedReport, error: reportError } = await supabase
      .from('autopsy_reports')
      .upsert({
        user_id: user.id,
        assessment_id: assessmentId,
        goal_id: assessment.goal_id,
        report_json: report,
        summary_text: report.summaryText,
        recoverable_marks_estimate:
          report.recoverableMarks.immediately_recoverable +
          report.recoverableMarks.short_term_recoverable +
          report.recoverableMarks.long_term_recoverable,
        top_patterns: report.repeatedPatterns.slice(0, 5),
        top_topics: report.highRiskTopics.slice(0, 5),
        status,
        generated_by: limits.hermesEnabled && memoryRows.length > 0 ? 'mixed' : 'deterministic',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'assessment_id' })
      .select('*')
      .single();
    if (reportError) throw reportError;

    await supabase
      .from('assessments')
      .update({
        status: 'report_ready',
        scored_marks: report.overview.score,
        total_marks: report.overview.totalMarks,
        updated_at: new Date().toISOString(),
      })
      .eq('id', assessmentId)
      .eq('user_id', user.id);

    await ingestLearningSignals(supabase, [
      {
        user_id: user.id,
        goal_id: assessment.goal_id,
        signal_type: 'assessment_result',
        source_type: 'autopsy_v3',
        source_id: assessmentId,
        confidence: 0.9,
        evidence: { overview: report.overview, reportId: persistedReport.id },
      },
      ...diagnoses.slice(0, limits.maxQuestionsPerAssessment).map((diagnosis: any) => ({
        user_id: user.id,
        goal_id: assessment.goal_id,
        signal_type: 'question_mistake' as const,
        source_type: 'autopsy_v3',
        source_id: diagnosis.question_id,
        subject: diagnosis.subject,
        topic: diagnosis.topic,
        confidence: diagnosis.confidence ?? 0.7,
        evidence: {
          assessmentId,
          mistakeType: diagnosis.mistake_type,
          severity: diagnosis.severity,
        },
      })),
    ], { publishEvent: true }).catch(() => []);

    await Promise.all([
      EventDispatcher.publish({
        user_id: user.id,
        type: 'AUTOPSY_V3_REPORT_READY',
        data: { assessmentId, reportId: persistedReport.id, generatedBy: persistedReport.generated_by },
        metadata: { source: 'autopsy_v3_report', goalId: assessment.goal_id },
        idempotency_key: `autopsy_v3_report_ready:${persistedReport.id}`,
      }).catch(() => undefined),
      memoryRows.length > 0
        ? EventDispatcher.publish({
          user_id: user.id,
          type: 'HERMES_MEMORY_UPDATED',
          data: { assessmentId, memoryIds: memoryRows.map((row) => row.id).filter(Boolean) },
          metadata: { source: 'autopsy_v3_report', goalId: assessment.goal_id },
          idempotency_key: `hermes_memory_updated:${persistedReport.id}`,
        }).catch(() => undefined)
        : Promise.resolve(),
      createRevisionCandidates(supabase, user.id, assessment.goal_id, report, assessmentId).catch(() => undefined),
      createRecoveryTask(supabase, user.id, assessment.goal_id, report, assessmentId).catch(() => undefined),
    ]);

    return jsonWithRequestId({ report: persistedReport, memoryRows, deterministicReport: report }, requestId);
  } catch (error) {
    return unexpectedApiErrorResponse(req, error, 'autopsy_v3_generate_report', 'Unable to generate Deep Autopsy report.');
  }
}

async function createRevisionCandidates(supabase: any, userId: string, goalId: string | null, report: any, assessmentId: string) {
  const rows = report.revisionActions.slice(0, 5).map((action: any) => ({
    user_id: userId,
    goal_id: goalId,
    front: action.title,
    back: action.reason,
    card_type: 'autopsy_recovery',
    source: 'autopsy_v3',
    tags: ['autopsy-v3'],
    subject: action.subject,
    chapter: action.topic,
    due: new Date().toISOString(),
    metadata: { assessmentId },
  }));
  if (rows.length > 0) await supabase.from('revision_cards').insert(rows);
}

async function createRecoveryTask(supabase: any, userId: string, goalId: string | null, report: any, assessmentId: string) {
  const action = report.revisionActions[0];
  if (!action) return;
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  await supabase.from('daily_microtasks').insert({
    user_id: userId,
    goal_id: goalId,
    title: `Repair: ${action.title}`,
    subject: action.subject,
    topic: action.topic,
    type: 'autopsy',
    task_date: tomorrow,
    status: 'pending',
    priority: 'high',
    estimated_minutes: 25,
    source: 'system',
    metadata: { source: 'autopsy_v3', assessmentId, reason: action.reason },
  });
}
