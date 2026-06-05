// lib/hermes/hermes-config.ts
// Hermes is an internal reasoning worker. It is NOT user-facing.
// All configuration is read from environment variables with safe defaults.
// If any variable is missing, the app must never crash.

import type { AIModelTier } from '@/lib/ai/budgeted';

export type HermesRuntimeMode = 'off' | 'lite' | 'full';

export interface HermesConfig {
  enabled: boolean;
  mode: HermesRuntimeMode;
  provider: 'internal' | 'mock';
  fastModel: AIModelTier;
  strongModel: AIModelTier;
  maxInputTokens: number;
  maxOutputTokens: number;
  timeoutMs: number;
  useStrongForMistakes: boolean;
  useStrongForMedical: boolean;
  dryRun: boolean;
  logOutput: boolean;
  sourceProcessingEnabled: boolean;
  revisionQualityEnabled: boolean;
  traceEnabled: boolean;
  nextActionEnabled: boolean;
  codingSandboxEnabled: boolean;
  agentLoopEnabled: boolean;
  maxContextMemories: number;
  maxDailyMemoryWritesPerUser: number;
  maxAiCallsPerEvent: number;
  autopsyV3Mode: HermesRuntimeMode;
}

function readBool(name: string, defaultValue: boolean): boolean {
  const v = process.env[name];
  if (v == null || v === '') return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
}

function readInt(name: string, defaultValue: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : defaultValue;
}

function readModelTier(name: string, defaultValue: AIModelTier): AIModelTier {
  const v = process.env[name];
  if (!v) return defaultValue;
  // We trust the configured value; type safety at call site
  return v as AIModelTier;
}

export function getHermesConfig(): HermesConfig {
  const modeStr = (process.env.HERMES_MODE || 'full').toLowerCase();
  const mode: HermesRuntimeMode = modeStr === 'full' ? 'full' : (modeStr === 'lite' ? 'lite' : 'off');
  
  const autopsyModeStr = (process.env.HERMES_AUTOPSY_V3_MODE || 'off').toLowerCase();
  const autopsyMode: HermesRuntimeMode = autopsyModeStr === 'full' ? 'full' : (autopsyModeStr === 'lite' ? 'lite' : 'off');

  return {
    enabled: readBool('HERMES_ENABLED', true),
    mode,
    provider: 'internal',
    fastModel: readModelTier('HERMES_FAST_MODEL', 'flash'),
    strongModel: readModelTier('HERMES_STRONG_MODEL', 'balanced'),
    maxInputTokens: readInt('HERMES_MAX_INPUT_TOKENS', 8000),
    maxOutputTokens: readInt('HERMES_MAX_OUTPUT_TOKENS', 1200),
    timeoutMs: readInt('HERMES_TIMEOUT_MS', 25000),
    useStrongForMistakes: readBool('HERMES_USE_STRONG_FOR_MISTAKES', false),
    useStrongForMedical: readBool('HERMES_USE_STRONG_FOR_MEDICAL', false),
    dryRun: readBool('HERMES_DRY_RUN', false),
    logOutput: readBool('HERMES_LOG_OUTPUT', false),
    sourceProcessingEnabled: readBool('HERMES_SOURCE_PROCESSING_ENABLED', true),
    revisionQualityEnabled: readBool('HERMES_REVISION_QUALITY_ENABLED', true),
    traceEnabled: readBool('HERMES_TRACE_ENABLED', false),
    nextActionEnabled: readBool('HERMES_NEXT_ACTION_ENABLED', false),
    codingSandboxEnabled: readBool('HERMES_CODING_SANDBOX_ENABLED', false),
    agentLoopEnabled: readBool('HERMES_AGENT_LOOP_ENABLED', false),
    maxContextMemories: readInt('HERMES_MAX_CONTEXT_MEMORIES', 8),
    maxDailyMemoryWritesPerUser: readInt('HERMES_MAX_DAILY_MEMORY_WRITES_PER_USER', 30),
    maxAiCallsPerEvent: readInt('HERMES_MAX_AI_CALLS_PER_EVENT', 1),
    autopsyV3Mode: autopsyMode,
  };
}

// Singleton for import convenience — re-read each call so tests can stub env
export function isHermesEnabled(): boolean {
  if (!readBool('HERMES_ENABLED', true)) return false;
  const mode = (process.env.HERMES_MODE || 'full').toLowerCase();
  return mode === 'lite' || mode === 'full';
}
