import { NextRequest } from 'next/server';
import { apiErrorResponse, getRequestId, unexpectedApiErrorResponse } from '@/lib/api/errors';
import { generateDeterministicAutopsyReport } from '@/lib/autopsy-v3/report-generator';
import { enforceDailyTableCap, jsonWithRequestId, requireAutopsyV3User } from '@/lib/autopsy-v3/permissions';
import { ingestLearningSignals } from '@/lib/learning-signals/ingest';
import { safePublishEvent } from '@/lib/events/safe-publish';
import { checkFeatureLimit, consumeFeatureUsage, featureLimitResponse } from '@/lib/usage/enforce-feature-limit';
import { featureDisabledResponse, isBetaFeatureEnabled } from '@/lib/config/beta-flags';
import { runCognitionAgentTurn } from '@/lib/agent/runtime';
import { logger } from '@/lib/utils/logger';

type RouteContext = { params: Promise<{ id: string }> | { id: string } };

export async function POST(req: NextRequest, context: RouteContext) {
  const requestId = getRequestId(req);
  try {
    const auth = await requireAutopsyV3User(requestId);
    if (auth.error) return auth.error;
    const { supabase, user, limits } = auth;
    const { id: assessmentId } = await context.params;
    if (!isBetaFeatureEnabled('autopsy_report')) return featureDisabledResponse(requestId);

    const { data: existingReport, error: existingReportError } = await supabase
      .from('autopsy_reports')
      .select('id')
      .eq('assessment_id', assessmentId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (existingReportError) throw existingReportError;
    const isReportRetry = !!existingReport?.id;

    if (!isReportRetry) {
      const featureGate = await checkFeatureLimit(user.id, 'autopsy_report');
      if (!featureGate.allowed) return featureLimitResponse(featureGate, requestId);
    }

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

    const [questionsRes, diagnosesRes] = await Promise.all([
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
    ]);
    if (questionsRes.error) throw questionsRes.error;
    if (diagnosesRes.error) throw diagnosesRes.error;

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
      priorMemories: [],
    });

    let memoryRows: any[] = [];
    let status: 'ready' | 'fallback_used' = 'ready';

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
        generated_by: 'deterministic',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'assessment_id' })
      .select('*')
      .single();
    if (reportError) throw reportError;

    if (!isReportRetry) {
      const usage = await consumeFeatureUsage(user.id, 'autopsy_report', 1, {
        assessmentId,
        reportId: persistedReport.id,
        idempotencyKey: `autopsy_report:${user.id}:${assessmentId}`,
      });
      if (!usage.allowed) return featureLimitResponse(usage, requestId);
    }

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
      safePublishEvent({
        user_id: user.id,
        type: 'AUTOPSY_V3_REPORT_READY',
        data: { assessmentId, reportId: persistedReport.id, generatedBy: persistedReport.generated_by },
        metadata: { source: 'autopsy_v3_report', goalId: assessment.goal_id },
        idempotency_key: `autopsy_v3_report_ready:${persistedReport.id}`,
      }),
      createRevisionCandidates(supabase, user.id, assessment.goal_id, report, assessmentId, memoryRows, limits).catch((err) => {
        console.error('Failed to create revision candidates', err);
      }),
      createRecoveryTask(supabase, user.id, assessment.goal_id, report, assessmentId).catch((err) => {
        console.error('Failed to create recovery task', err);
      }),
    ]);

    // Phase 7: Wire autopsy through agent runtime for ATLAS/MEMORY mutations
    // The runtime processes autopsy results and creates MEMORY cards, updates ATLAS mastery
    let agentLoopResult: any = null;
    try {
      agentLoopResult = await runCognitionAgentTurn({
        userId: user.id,
        channel: 'autopsy',
        goalId: assessment.goal_id ?? undefined,
        payload: {
          assessmentId,
          reportId: persistedReport.id,
          subject: assessment.subject ?? null,
          topic: assessment.title ?? null,
          overview: report.overview,
          recoverableMarks: report.recoverableMarks,
          revisionActions: report.revisionActions.slice(0, 20),
          repeatedPatterns: report.repeatedPatterns,
          highRiskTopics: report.highRiskTopics,
          diagnosesCount: diagnoses.length,
          source: 'autopsy_v3_generate_report',
        },
        sessionId: undefined,
      }, { supabase: supabase as any });

      logger.info('Autopsy agent runtime completed', {
        userId: user.id,
        assessmentId,
        reportId: persistedReport.id,
        changed: agentLoopResult?.mutationSummary?.changed,
        conceptsUpdated: agentLoopResult?.mutationSummary?.conceptsUpdated,
        revisionCardsCreated: agentLoopResult?.mutationSummary?.revisionCardsCreated,
      });
    } catch (runtimeError) {
      // Runtime failure should not fail report generation
      logger.warn('Autopsy agent runtime failed (non-fatal)', {
        userId: user.id,
        assessmentId,
        error: runtimeError instanceof Error ? runtimeError.message : String(runtimeError),
      });
    }

    return jsonWithRequestId({ report: persistedReport, memoryRows, deterministicReport: report, agentMutationSummary: agentLoopResult?.mutationSummary ?? null, amaura: { cascade: 'queued' } }, requestId);
  } catch (error) {
    return unexpectedApiErrorResponse(req, error, 'autopsy_v3_generate_report', 'Unable to generate Deep Autopsy report.');
  }
}

function normalizedRevisionKey(userId: string, assessmentId: string, action: any, index: number) {
  const seed = [userId, assessmentId, action.subject, action.topic, action.title, index].join(':').toLowerCase();
  return `autopsy-v3:${seed.replace(/[^a-z0-9:]+/g, '-').slice(0, 180)}`;
}

async function createRevisionCandidates(supabase: any, userId: string, goalId: string | null, report: any, assessmentId: string, memoryRows: any[] = [], limits: any = {}) {
  const featureGate = await checkFeatureLimit(userId, 'revision_generation');
  if (!featureGate.allowed) return;

  const rows = report.revisionActions.slice(0, Math.min(20, limits.maxRevisionCardsPerReport ?? 20)).map((action: any, index: number) => {
    const linkedMemory = memoryRows.find(m => m.topic === action.topic) || memoryRows[index % memoryRows.length];
    return {
      user_id: userId,
      goal_id: goalId,
      front: action.title,
      back: action.reason,
      card_type: 'autopsy_recovery',
      source: linkedMemory ? 'amaura_pattern_memory' : 'autopsy_v3',
      source_id: linkedMemory ? linkedMemory.id : assessmentId,
      tags: ['autopsy-v3'],
      subject: action.subject,
      chapter: action.topic,
      due: new Date().toISOString(),
      normalized_key: normalizedRevisionKey(userId, assessmentId, action, index),
      metadata: { assessmentId, patternMemoryId: linkedMemory?.id, idempotencyKey: `revision-card:${userId}:${assessmentId}:${index}` },
    };
  });
  if (rows.length === 0) return;

  const keys = rows.map((row: any) => row.normalized_key);
  const { data: existing, error: existingError } = await supabase
    .from('revision_cards')
    .select('normalized_key')
    .eq('user_id', userId)
    .in('normalized_key', keys);
  if (existingError) throw existingError;

  const existingKeys = new Set((existing ?? []).map((row: any) => row.normalized_key));
  const missingRows = rows.filter((row: any) => !existingKeys.has(row.normalized_key));
  if (missingRows.length > 0) {
    await supabase.from('revision_cards').insert(missingRows);
    await consumeFeatureUsage(userId, 'revision_generation', 1, {
      assessmentId,
      createdCards: missingRows.length,
      idempotencyKey: `revision_generation:${userId}:${assessmentId}`,
    });
  }
}

async function createRecoveryTask(supabase: any, userId: string, goalId: string | null, report: any, assessmentId: string) {
  const action = report.revisionActions[0];
  if (!action) return;
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const metadata = { source: 'autopsy_v3', assessmentId, reason: action.reason };
  const { data: existing, error: existingError } = await supabase
    .from('daily_microtasks')
    .select('id')
    .eq('user_id', userId)
    .eq('task_date', tomorrow)
    .eq('type', 'autopsy')
    .contains('metadata', { source: 'autopsy_v3', assessmentId })
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return;

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
    metadata,
  });
}
