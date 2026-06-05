import { NextResponse } from 'next/server';

export type BetaFeature =
  | 'ai'
  | 'rag_upload'
  | 'rag_query'
  | 'autopsy_upload'
  | 'autopsy_report'
  | 'hermes_write'
  | 'worker_ai'
  | 'background_job'
  | 'session_card'
  | 'revision'
  | 'atlas'
  | 'debug_page';

function boolFromEnv(key: string, fallback: boolean): boolean {
  const value = process.env[key];
  if (value == null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function numberFromEnv(key: string, fallback: number): number {
  const value = Number(process.env[key]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

export function getBetaFlags() {
  return {
    paidBetaGateEnabled: boolFromEnv('PAID_BETA_GATE_ENABLED', true),
    manualBetaAccessOnly: boolFromEnv('MANUAL_BETA_ACCESS_ONLY', true),
    aiGlobalKillSwitch: boolFromEnv('AI_GLOBAL_KILL_SWITCH', false),
    ragUploadsEnabled: boolFromEnv('RAG_UPLOADS_ENABLED', true),
    ragQueriesEnabled: boolFromEnv('RAG_QUERIES_ENABLED', true),
    autopsyUploadsEnabled: boolFromEnv('AUTOPSY_UPLOADS_ENABLED', true),
    autopsyReportsEnabled: boolFromEnv('AUTOPSY_REPORTS_ENABLED', true),
    hermesWritesEnabled: boolFromEnv('HERMES_WRITES_ENABLED', true),
    workerAiEnabled: boolFromEnv('WORKER_AI_ENABLED', false),
    backgroundJobsEnabled: boolFromEnv('BACKGROUND_JOBS_ENABLED', true),
    sessionCardEnabled: boolFromEnv('SESSION_CARD_ENABLED', true),
    revisionEnabled: boolFromEnv('REVISION_ENABLED', true),
    atlasEnabled: boolFromEnv('ATLAS_ENABLED', true),
    debugPagesEnabled: boolFromEnv('DEBUG_PAGES_ENABLED', false),
    globalDailyAiBudgetUsd: numberFromEnv('GLOBAL_DAILY_AI_BUDGET_USD', 8),
    globalHourlyAiRequestLimit: numberFromEnv('GLOBAL_HOURLY_AI_REQUEST_LIMIT', 300),
    globalDailyAiRequestLimit: numberFromEnv('GLOBAL_DAILY_AI_REQUEST_LIMIT', 2500),
    globalAutopsyReportsPerDay: numberFromEnv('GLOBAL_AUTOPSY_REPORTS_PER_DAY', 200),
    globalRagUploadsPerDay: numberFromEnv('GLOBAL_RAG_UPLOADS_PER_DAY', 150),
    globalChatMessagesPerDay: numberFromEnv('GLOBAL_CHAT_MESSAGES_PER_DAY', 4000),
    globalMaxActiveUsersPerDay: numberFromEnv('GLOBAL_MAX_ACTIVE_USERS_PER_DAY', 120),
  };
}

export function isBetaFeatureEnabled(feature: BetaFeature): boolean {
  const flags = getBetaFlags();
  switch (feature) {
    case 'ai':
      return !flags.aiGlobalKillSwitch;
    case 'rag_upload':
      return flags.ragUploadsEnabled;
    case 'rag_query':
      return flags.ragQueriesEnabled;
    case 'autopsy_upload':
      return flags.autopsyUploadsEnabled;
    case 'autopsy_report':
      return flags.autopsyReportsEnabled;
    case 'hermes_write':
      return flags.hermesWritesEnabled;
    case 'worker_ai':
      return flags.workerAiEnabled;
    case 'background_job':
      return flags.backgroundJobsEnabled;
    case 'session_card':
      return flags.sessionCardEnabled;
    case 'revision':
      return flags.revisionEnabled;
    case 'atlas':
      return flags.atlasEnabled;
    case 'debug_page':
      return flags.debugPagesEnabled;
    default:
      return false;
  }
}

export function featureDisabledResponse(requestId?: string): NextResponse {
  return NextResponse.json(
    {
      error: 'feature_temporarily_disabled',
      message: 'This feature is temporarily paused during beta maintenance.',
      ...(requestId ? { requestId } : {}),
    },
    {
      status: 503,
      headers: requestId ? { 'x-request-id': requestId } : undefined,
    }
  );
}
