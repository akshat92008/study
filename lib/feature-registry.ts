import { NextResponse } from 'next/server';

export type AppLaunchMode = 'local' | 'staging' | 'private_beta' | 'public_free' | 'public_paid' | 'maintenance';

export type AppFeature =
  | 'chat'
  | 'practice'
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
  | 'debug_page'
  | 'autopsy_ui'
  | 'analytics_ui'
  | 'atlas_ui'
  | 'flashcards_ui'
  | 'voice_chat'
  | 'knowledge_ui'
  | 'ai_global'
  | 'paid_gate';

function boolFromEnv(key: string, fallback: boolean): boolean {
  const value = process.env[key];
  if (value == null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function numberFromEnv(key: string, fallback: number): number {
  const value = Number(process.env[key]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

export function getAppLaunchMode(): AppLaunchMode {
  const mode = process.env.APP_LAUNCH_MODE as AppLaunchMode | undefined;
  if (mode && ['local', 'staging', 'private_beta', 'public_free', 'public_paid', 'maintenance'].includes(mode)) {
    return mode;
  }
  return process.env.NODE_ENV === 'production' ? 'public_paid' : 'local';
}

export function getFeatureLimits() {
  return {
    globalDailyAiBudgetUsd: numberFromEnv('GLOBAL_DAILY_AI_BUDGET_USD', 8),
    globalHourlyAiRequestLimit: numberFromEnv('GLOBAL_HOURLY_AI_REQUEST_LIMIT', 300),
    globalDailyAiRequestLimit: numberFromEnv('GLOBAL_DAILY_AI_REQUEST_LIMIT', 2500),
    globalAutopsyReportsPerDay: numberFromEnv('GLOBAL_AUTOPSY_REPORTS_PER_DAY', 200),
    globalRagUploadsPerDay: numberFromEnv('GLOBAL_RAG_UPLOADS_PER_DAY', 150),
    globalChatMessagesPerDay: numberFromEnv('GLOBAL_CHAT_MESSAGES_PER_DAY', 4000),
    globalMaxActiveUsersPerDay: numberFromEnv('GLOBAL_MAX_ACTIVE_USERS_PER_DAY', 120),
  };
}

export function isFeatureEnabled(feature: AppFeature): boolean {
  const mode = getAppLaunchMode();
  
  if (mode === 'maintenance') {
    return false; // All features off during maintenance
  }

  // AI Global Kill Switch overrides everything
  if (feature === 'ai_global') {
    return !boolFromEnv('AI_GLOBAL_KILL_SWITCH', false);
  }

  // Base configurations driven by ENV or default fallback
  const features: Record<AppFeature, boolean> = {
    chat: true,
    practice: true,
    rag_upload: boolFromEnv('RAG_UPLOADS_ENABLED', true),
    rag_query: boolFromEnv('RAG_QUERIES_ENABLED', true),
    autopsy_upload: boolFromEnv('AUTOPSY_UPLOADS_ENABLED', true),
    autopsy_report: boolFromEnv('AUTOPSY_REPORTS_ENABLED', true),
    hermes_write: boolFromEnv('HERMES_WRITES_ENABLED', true),
    worker_ai: boolFromEnv('WORKER_AI_ENABLED', false),
    background_job: boolFromEnv('BACKGROUND_JOBS_ENABLED', true),
    session_card: boolFromEnv('SESSION_CARD_ENABLED', true),
    revision: boolFromEnv('REVISION_ENABLED', true),
    atlas: boolFromEnv('ATLAS_ENABLED', true),
    debug_page: boolFromEnv('DEBUG_PAGES_ENABLED', false),
    autopsy_ui: true,
    analytics_ui: false,
    atlas_ui: false,
    flashcards_ui: true,
    voice_chat: false,
    knowledge_ui: true,
    ai_global: true,
    paid_gate: boolFromEnv('PAID_BETA_GATE_ENABLED', true),
  };

  // In public_paid mode, we force unapproved or experimental features OFF
  // regardless of environment variables to prevent accidental leaks.
  if (mode === 'public_paid') {
    features.debug_page = false;
    features.worker_ai = false; // Turn off worker AI if it's not production ready
    features.analytics_ui = false;
    features.atlas_ui = false; // Turn off Atlas UI if it's still experimental
    features.voice_chat = false;
  }

  return features[feature];
}

export function featureDisabledResponse(requestId?: string): NextResponse {
  return NextResponse.json(
    {
      error: 'feature_temporarily_disabled',
      message: 'This feature is temporarily unavailable.',
      ...(requestId ? { requestId } : {}),
    },
    {
      status: 503,
      headers: requestId ? { 'x-request-id': requestId } : undefined,
    }
  );
}
