import { isEnabled } from '@/lib/config/flags';

export const hermesRuntimeConfig = {
  // ── Hermes internal worker flags (never user-facing) ──
  hermesEnabled: () => isEnabled('HERMES_ENABLED', false),
  hermesSourceProcessing: () => isEnabled('HERMES_SOURCE_PROCESSING_ENABLED', false),
  hermesCodingSandbox: () => isEnabled('HERMES_CODING_SANDBOX_ENABLED', false),
  hermesAgentLoop: () => isEnabled('HERMES_AGENT_LOOP_ENABLED', false),
  hermesNextAction: () => isEnabled('HERMES_NEXT_ACTION_ENABLED', false),
  hermesTrace: () => isEnabled('HERMES_TRACE_ENABLED', false),
};
