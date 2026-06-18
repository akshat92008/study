import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import { apiErrorResponse, getRequestId, unexpectedApiErrorResponse } from '@/lib/api/errors';

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return apiErrorResponse('unauthorized', {
        status: 401,
        message: 'Authentication is required.',
        requestId,
      });
    }

    const { searchParams } = new URL(req.url);
    const rawLimit = Number(searchParams.get('limit') ?? 10);
    const limit = Number.isFinite(rawLimit)
      ? Math.min(Math.max(rawLimit, 1), 50)
      : 10;

    // We fetch recent learner-facing actions to show as feed items.
    // Do NOT select 'title' - production DB may not have it yet (add via migration).
    const { data, error } = await supabase
      .from('agent_actions')
      .select('id, agent_name, action_type, status, reason, target_type, target_id, created_at, evidence, error, error_code')
      .eq('user_id', user.id)
      .eq('status', 'applied')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error('[amaura:activity] query failed', {
        userId: user.id,
        error: {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        },
      });
      throw error;
    }

    // Derive title in code to avoid DB column dependency.
    const activity = (data ?? []).map((item: any) => ({
      ...item,
      title: titleForAction(item.action_type, item.agent_name),
    }));

    return NextResponse.json({ activity }, { headers: { 'x-request-id': requestId } });
  } catch (error: any) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('[amaura:activity] unexpected error', {
      userId: 'unknown',
      error: {
        message: err.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
      },
    });
    return unexpectedApiErrorResponse(req, error, 'amaura_activity_get_unhandled', 'Unable to load Amaura activity.');
  }
}

function titleForAction(actionType?: string | null, agentName?: string | null) {
  switch (actionType) {
    case 'source_used':
      return 'Source used';
    case 'weak_area_detected':
      return 'Weak area detected';
    case 'misconception_detected':
      return 'Misconception repaired';
    case 'memory_card_created':
    case 'revision_needed':
      return 'MEMORY card created';
    case 'practice_attempt_submitted':
      return 'Practice processed';
    case 'atlas_mastery_updated':
    case 'concept_understood':
      return 'ATLAS mastery updated';
    case 'mission_progress_updated':
    case 'practice_needed':
      return 'Mission progress updated';
    case 'session_completed':
      return 'Session completed';
    case 'daily_plan_adapted':
      return 'Daily plan adapted';
    case 'autopsy_mistake_recorded':
      return 'Autopsy mistake recorded';
    case 'autopsy_mistake_detected':
      return 'Autopsy repair created';
    case 'revision_reviewed':
      return 'Repair evidence recorded';
    default:
      return agentName === 'mind' ? 'MIND observation' :
        agentName === 'atlas' ? 'ATLAS map update' :
        agentName === 'memory' ? 'MEMORY card created' :
        agentName === 'planner' ? 'PLANNER adapted session' :
        agentName === 'command' ? 'COMMAND mission updated' :
        `${agentName?.toUpperCase?.() ?? 'AMAURA'} action`;
  }
}
