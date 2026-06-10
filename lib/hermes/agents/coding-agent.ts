// lib/hermes/agents/coding-agent.ts
// HERMES CODING AGENT STUB
//
// TODO: Production code execution needs isolated sandbox/container.
// DO NOT use local Mac shell or Next.js process for real user code.
// This stub exists only to reserve the interface for future implementation.
//
// Activation: HERMES_CODING_SANDBOX_ENABLED=true (currently NOT safe for production)
// Current state: Always throws HermesDisabledError.

import { HermesDisabledError } from '../hermes-errors';
import { hermesLogger } from '../hermes-logger';

export interface HermesCodingInput {
  userId: string;
  goalId?: string | null;
  code: string;
  language: string;
  problem?: string | null;
}

export interface HermesCodingResult {
  output: string;
  errors: string[];
  passed: boolean;
  feedback: string;
}

/**
 * STUB: Coding sandbox agent.
 *
 * NOT implemented. Do not wire to any user-facing route.
 * Requires isolated execution environment (Docker/Firecracker) before enabling.
 */
export async function runHermesCodingAgent(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _input: HermesCodingInput
): Promise<HermesCodingResult> {
  hermesLogger.warn('Coding agent called but it is hard-disabled for production launch.');
  throw new HermesDisabledError();

  // TODO: Implement isolated sandbox execution
  // Requirements before enabling:
  // 1. Isolated container per execution (no shared process)
  // 2. Resource limits (CPU, memory, timeout)
  // 3. No filesystem access to host
  // 4. No network access from sandboxed code
  // 5. Output sanitization before returning to Cognition
  throw new Error(
    'Hermes coding sandbox is not yet implemented. Set HERMES_CODING_SANDBOX_ENABLED=false.'
  );
}
