import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const rawLimit = Number(searchParams.get('limit') ?? 10);
    const limit = Number.isFinite(rawLimit)
      ? Math.min(Math.max(rawLimit, 1), 50)
      : 10;

    // We fetch recent applied or skipped actions to show as feed items.
    // Do NOT select 'title' — production DB may not have it yet (add via migration).
    const { data, error } = await supabase
      .from('agent_actions')
      .select('id, agent_name, action_type, status, reason, target_type, created_at, evidence')
      .eq('user_id', user.id)
      .in('status', ['applied', 'skipped', 'failed'])
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
      // Never 500 for normal empty-state or missing-column conditions
      return NextResponse.json({ activity: [] });
    }

    // Derive title in code to avoid DB column dependency
    const activity = (data ?? []).map((item: any) => ({
      ...item,
      title:
        item.agent_name === 'mind' ? 'MIND observation' :
        item.agent_name === 'atlas' ? 'ATLAS map update' :
        item.agent_name === 'memory' ? 'MEMORY card created' :
        item.agent_name === 'planner' ? 'PLANNER adapted session' :
        item.agent_name === 'command' ? 'COMMAND mission updated' :
        `${item.agent_name?.toUpperCase?.() ?? 'AMAURA'} action`,
    }));

    return NextResponse.json({ activity });
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
    // Never let this endpoint 500 for normal use — return empty activity
    return NextResponse.json({ activity: [] });
  }
}
