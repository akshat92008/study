import { isEnabled } from '@/lib/feature-registry';

export const hermesRuntimeConfig = {
  // ── Hermes internal worker flags (never user-facing) ──
  hermesEnabled: () => isEnabled('HERMES_ENABLED', true),
  hermesSourceProcessing: () => isEnabled('HERMES_SOURCE_PROCESSING_ENABLED', true),
  hermesCodingSandbox: () => isEnabled('HERMES_CODING_SANDBOX_ENABLED', false),
  hermesAgentLoop: () => isEnabled('HERMES_AGENT_LOOP_ENABLED', true),
  hermesNextAction: () => isEnabled('HERMES_NEXT_ACTION_ENABLED', true),
  hermesTrace: () => isEnabled('HERMES_TRACE_ENABLED', true),
};
