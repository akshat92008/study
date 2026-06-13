import { NextRequest } from 'next/server';
import { apiErrorResponse, getRequestId, unexpectedApiErrorResponse } from '@/lib/api/errors';
import { generateDeterministicAutopsyReport } from '@/lib/autopsy-v3/report-generator';
import { enforceDailyTableCap, jsonWithRequestId, requireAutopsyV3User } from '@/lib/autopsy-v3/permissions';
import { projectAutopsyV3Results } from '@/lib/autopsy-v3/projection';
import { ingestLearningSignals } from '@/lib/learning-signals/ingest';
import { safePublishEvent } from '@/lib/events/safe-publish';
import { checkFeatureLimit, consumeFeatureUsage, featureLimitResponse } from '@/lib/usage/enforce-feature-limit';
import { featureDisabledResponse, isFeatureEnabled } from '@/lib/feature-registry';
import { runHermesTurn } from '@/lib/agent/runtime';
import { logger } from '@/lib/utils/logger';

type RouteContext = { params: Promise<{ id: string }> | { id: string } };

export async function POST(req: NextRequest, context: RouteContext) {
  const requestId = getRequestId(req);
  try {
    const auth = await requireAutopsyV3User(requestId);
    if (auth.error) return auth.error;
    const { supabase, user, limits } = auth;
    const { id: assessmentId } = await context.params;
    if (!isFeatureEnabled('autopsy_report')) return featureDisabledResponse(requestId);

    const { data: existingReport, error: existingReportError } = await supabase
      .from('autopsy_reports')
      .select('id, status')
      .eq('assessment_id', assessmentId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (existingReportError) throw existingReportError;
    const isReportRetry = !!existingReport?.id;

    if (existingReport?.status === 'generating') {
      return apiErrorResponse('conflict', { status: 409, message: 'Report is already generating.', requestId });
    }

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

    const answeredQuestions = questions.filter((question: any) => String(question.user_answer ?? '').trim().length > 0);
    if (answeredQuestions.length === 0) {
      await supabase
        .from('assessments')
        .update({ status: 'parsing_failed', updated_at: new Date().toISOString() })
        .eq('id', assessmentId)
        .eq('user_id', user.id);
      return apiErrorResponse('AUTOPSY_PARSE_FAILED', {
        status: 422,
        message: 'Autopsy could not parse any learner answers. Add answers before generating a report.',
        requestId,
      });
    }

    const diagnoses = diagnosesRes.data ?? [];
    const wrongOrSkipped = questions.filter((question: any) => ['incorrect', 'skipped'].includes(question.status));
    if (wrongOrSkipped.length > 0 && diagnoses.length === 0) {
      return apiErrorResponse('AUTOPSY_DIAGNOSIS_FAILED', {
        status: 409,
        message: 'Wrong or skipped answers must be diagnosed before learner-state projection.',
        requestId,
      });
    }

    // Phase 8.3: Write empty report record with 'generating' status before expensive work
    const { data: pendingReport, error: pendingError } = await supabase
      .from('autopsy_reports')
      .upsert({
        user_id: user.id,
        assessment_id: assessmentId,
        goal_id: assessment.goal_id,
        status: 'generating',
        generated_by: 'deterministic',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'assessment_id' })
      .select('id')
      .single();
    if (pendingError) throw pendingError;

    if (!isReportRetry) {
      const usage = await consumeFeatureUsage(user.id, 'autopsy_report', 1, {
        assessmentId,
        reportId: pendingReport.id,
        idempotencyKey: `autopsy_report:${user.id}:${assessmentId}`,
      });
      if (!usage.allowed) return featureLimitResponse(usage, requestId);
    }

    let projectionStarted = false;
    try {
      const report = generateDeterministicAutopsyReport({
        assessment: assessment as any,
        questions: questions as any,
        diagnoses: diagnoses as any,
        priorMemories: [],
      });

      let status: 'ready' | 'fallback_used' = 'ready';

      const { data: persistedReport, error: reportError } = await supabase
        .from('autopsy_reports')
        .update({
          report_json: report,
          summary_text: report.summaryText,
          recoverable_marks_estimate:
            report.recoverableMarks.immediately_recoverable +
            report.recoverableMarks.short_term_recoverable +
            report.recoverableMarks.long_term_recoverable,
          top_patterns: report.repeatedPatterns.slice(0, 5),
          top_topics: report.highRiskTopics.slice(0, 5),
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', pendingReport.id)
        .select('*')
        .single();
      if (reportError) throw reportError;

      const assessmentStatus = (diagnoses.length === 0) ? 'completed_clean' : 'report_ready';

      await supabase
        .from('assessments')
        .update({
          status: assessmentStatus,
          scored_marks: report.overview.score,
          total_marks: report.overview.totalMarks,
          updated_at: new Date().toISOString(),
        })
        .eq('id', assessmentId)
        .eq('user_id', user.id);

      // Canonical Deterministic Projection (Fix 1-5)
      const projection = diagnoses.length > 0
        ? await (async () => {
            projectionStarted = true;
            return projectAutopsyV3Results({
            supabase,
            userId: user.id,
            assessmentId,
            reportId: persistedReport.id,
            report,
            diagnoses,
            goalId: assessment.goal_id,
            subject: assessment.subject,
            });
          })()
        : { mistakesProjected: 0, success: true };

      if (diagnoses.length > 0) {
        const { error: projectedStatusError } = await supabase
          .from('assessments')
          .update({ status: 'projected', updated_at: new Date().toISOString() })
          .eq('id', assessmentId)
          .eq('user_id', user.id);
        if (projectedStatusError) throw projectedStatusError;
      }

    // Write signals for agent visibility (Fix 2)
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
    ], { publishEvent: false }).catch(() => []);

    await safePublishEvent({
      user_id: user.id,
      type: 'AUTOPSY_V3_REPORT_READY',
      data: { assessmentId, reportId: persistedReport.id, generatedBy: persistedReport.generated_by },
      metadata: { source: 'autopsy_v3_report', goalId: assessment.goal_id },
      idempotency_key: `autopsy_v3_report_ready:${persistedReport.id}`,
    });

      // Phase 7: Wire autopsy through agent runtime
      let agentLoopResult: any = null;
      try {
        agentLoopResult = await runHermesTurn({
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
            alreadyProjected: true, // Prevent agent from duplicating ATLAS/MEMORY updates
          },
          sessionId: undefined,
        }, { supabase: supabase as any });
      } catch (runtimeError) {
        logger.warn('Autopsy agent runtime failed (non-fatal)', { userId: user.id, error: runtimeError });
      }

      return jsonWithRequestId({ report: persistedReport, deterministicReport: report, projection, agentMutationSummary: agentLoopResult?.mutationSummary ?? null }, requestId);
    } catch (err) {
      // Phase 8.3: Mark status as failed if projection or generation fails
      await supabase
        .from('autopsy_reports')
        .update({ status: 'failed', updated_at: new Date().toISOString() })
        .eq('assessment_id', assessmentId);
      await supabase
        .from('assessments')
        .update({
          status: projectionStarted ? 'projection_failed' : 'failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', assessmentId)
        .eq('user_id', user.id);
      
      throw err;
    }
  } catch (error) {
    return unexpectedApiErrorResponse(req, error, 'autopsy_v3_generate_report', 'Unable to generate Deep Autopsy report.');
  }
}
