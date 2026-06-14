import type { AgentObservation, RetrievedSourceChunk, ToolResultRecord, VerificationResult } from '@/lib/agent/types';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function verifyAgentTurn(input: {
  supabase: SupabaseClient;
  userId: string;
  runId: string;
  observation: AgentObservation;
  sourceChunks: RetrievedSourceChunk[];
  toolResults: ToolResultRecord[];
}): Promise<VerificationResult> {
  const checks: VerificationResult['checks'] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  // Check 1: Source chunks retrieval
  if (input.observation.sourceRequested) {
    checks.push({
      name: 'source_chunks_retrieved',
      ok: input.sourceChunks.length > 0,
      entityType: 'study_material_chunk',
      message: input.sourceChunks.length > 0 ? `${input.sourceChunks.length} chunks retrieved` : 'Source was requested but no chunks were retrieved.',
    });
  }

  // Check 2: Core Loop Trace for mutations
  const mutationTools = [
    'apply_practice_attempt', 'write_learning_event', 'upsert_atlas_concept',
    'update_concept_mastery', 'create_memory_card', 'update_microtarget',
    'record_autopsy_mistake', 'complete_session'
  ];

  const hasMutations = input.toolResults.some(res => 
    res.success && res.changed && mutationTools.includes(res.toolName)
  );

  let traceCompleted = true;

  if (hasMutations) {
    const { data: trace, error: traceError } = await input.supabase
      .from('core_loop_traces')
      .select('status, error_code')
      .eq('id', input.runId)
      .maybeSingle();

    if (traceError) {
      warnings.push(`Could not query core_loop_traces: ${traceError.message}`);
      traceCompleted = false;
    } else if (!trace) {
      errors.push('core_loop_trace_missing: Agent requested mutations but no trace was committed by the projection RPC.');
      traceCompleted = false;
    } else if (trace.status !== 'completed') {
      errors.push(`core_loop_trace_failed: Trace status is ${trace.status}. Error: ${trace.error_code}`);
      traceCompleted = false;
    }

    checks.push({
      name: 'core_loop_projection',
      ok: traceCompleted,
      entityType: 'core_loop_trace',
      entityId: input.runId,
      message: traceCompleted ? 'Atomic core loop projection verified' : 'Core loop projection trace incomplete or missing',
    });
  }

  // Process tool result basic errors
  for (const result of input.toolResults) {
    if (!result.success) {
      errors.push(`${result.toolName}: ${result.error?.message ?? result.summary}`);
      
      // Downgrade status if failed
      await input.supabase.from('agent_tool_calls')
        .update({
          status: 'failed',
          changed: false,
        })
        .eq('id', result.id);
    } else {
      // Mark as verified since it succeeded and the core loop was atomic
      await input.supabase.from('agent_tool_calls')
        .update({ verification: { ok: true, name: 'atomic_projection_verified' } })
        .eq('id', result.id);
    }
  }

  return {
    ok: errors.length === 0 && checks.every((check) => check.ok),
    checks,
    warnings,
    errors,
  };
}
