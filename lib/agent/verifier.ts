import type { AgentObservation, RetrievedSourceChunk, ToolResultRecord, VerificationResult } from '@/lib/agent/types';
import type { SupabaseClient } from '@supabase/supabase-js';

async function exists(
  supabase: SupabaseClient,
  input: { table: string; id: string; userId: string; userColumn?: string }
) {
  const { data, error } = await supabase
    .from(input.table)
    .select('id')
    .eq('id', input.id)
    .eq(input.userColumn ?? 'user_id', input.userId)
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  return { ok: Boolean((data as any)?.id), message: (data as any)?.id ? 'verified' : 'missing' };
}

export async function verifyAgentTurn(input: {
  supabase: SupabaseClient;
  userId: string;
  observation: AgentObservation;
  sourceChunks: RetrievedSourceChunk[];
  toolResults: ToolResultRecord[];
}): Promise<VerificationResult> {
  const checks: VerificationResult['checks'] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  async function verifyEntity(result: ToolResultRecord, entityType: string, table: string, id: string, userColumn = 'user_id') {
    const verified = await exists(input.supabase, { table, id, userId: input.userId, userColumn });
    checks.push({
      name: `${result.toolName}:${table}`,
      ok: verified.ok,
      entityType,
      entityId: id,
      message: verified.message,
    });
    if (!verified.ok) errors.push(`${result.toolName}: could not verify ${entityType} ${id}`);
  }

  if (input.observation.sourceRequested) {
    checks.push({
      name: 'source_chunks_retrieved',
      ok: input.sourceChunks.length > 0,
      entityType: 'study_material_chunk',
      message: input.sourceChunks.length > 0 ? `${input.sourceChunks.length} chunks retrieved` : 'Source was requested but no chunks were retrieved.',
    });
  }

  for (const result of input.toolResults) {
    if (!result.success) {
      errors.push(`${result.toolName}: ${result.error?.message ?? result.summary}`);
      continue;
    }

    if (result.toolName === 'apply_practice_attempt') {
      const data = result.data as any;
      const actionId = typeof data?.agentActionId === 'string' ? data.agentActionId : result.entityIds?.[0];
      if (typeof actionId === 'string') await verifyEntity(result, 'agent_action', 'agent_actions', actionId);
      for (const id of Array.isArray(data?.conceptIds) ? data.conceptIds.slice(0, 8) : []) {
        if (typeof id === 'string') await verifyEntity(result, 'concept', 'concepts', id);
      }
      for (const id of Array.isArray(data?.cardIds) ? data.cardIds.slice(0, 8) : []) {
        if (typeof id === 'string') await verifyEntity(result, 'revision_card', 'revision_cards', id);
      }
      continue;
    }

    if (!result.changed || !result.entityType || !result.entityIds?.length) continue;

    const ids = result.entityIds.slice(0, 8);
    for (const id of ids) {
      let table: string | null = null;
      const userColumn = 'user_id';
      if (result.entityType === 'concept') table = 'concepts';
      if (result.entityType === 'revision_card') table = 'revision_cards';
      if (result.entityType === 'daily_microtask') table = 'daily_microtasks';
      if (result.entityType === 'study_session') table = 'study_sessions';
      if (result.entityType === 'mistake') table = 'mistakes';
      if (result.entityType === 'learning_event') table = id === result.entityIds[0] ? 'learner_events' : 'agent_actions';
      if (!table) continue;
      await verifyEntity(result, result.entityType, table, id, userColumn);
    }
  }

  return {
    ok: errors.length === 0 && checks.every((check) => check.ok),
    checks,
    warnings,
    errors,
  };
}
