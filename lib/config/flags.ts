export function isEnabled(name: string, defaultValue = false): boolean {
  const value = process.env[name]

  if (value == null || value === '') {
    return defaultValue
  }

  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())
}

/**
 * Budget mode controls AI frugality.
 * - ultra_cheap: Deterministic first, AI only as last resort
 * - balanced: Mix of deterministic and AI (default for beta)
 * - premium: Full AI assistance
 */
export type BudgetMode = 'ultra_cheap' | 'balanced' | 'premium';

export function getBudgetMode(): BudgetMode {
  const mode = process.env.BUDGET_MODE?.toLowerCase()?.trim();
  if (mode === 'ultra_cheap') return 'ultra_cheap';
  if (mode === 'premium') return 'premium';
  return 'balanced'; // default
}

export const featureFlags = {
  // ── Core RAG / Autopsy ──
  visionUploads: () => isEnabled('ENABLE_VISION_UPLOADS', false),
  autopsyUploads: () => isEnabled('ENABLE_AUTOPSY_UPLOADS', true),
  ragIngestion: () => isEnabled('ENABLE_RAG_INGESTION', true),
  autopsyProcessing: () => isEnabled('ENABLE_AUTOPSY_PROCESSING', false),
  agentActions: () => isEnabled('ENABLE_AGENT_ACTIONS', false),
  aiEscalation: () => isEnabled('ENABLE_AI_ESCALATION', true),

  // ── Global Learning OS (new) ──
  /** Enable the new goal-agnostic global onboarding flow */
  globalOnboarding: () => isEnabled('ENABLE_GLOBAL_ONBOARDING', true),
  /** Whether NEET preset is surfaced in the UI */
  presetNeet: () => isEnabled('ENABLE_PRESET_NEET', true),
  /** Protect routes not in the beta allowlist */
  betaOnlyRoutes: () => isEnabled('ENABLE_BETA_ONLY_ROUTES', false),
  /** Enable document generation (formula sheets, summaries) */
  documentGeneration: () => isEnabled('ENABLE_DOCUMENT_GENERATION', false),
  /** Enable assessment autopsy (replaces "mock autopsy" naming in logic) */
  assessmentAutopsy: () => isEnabled('ENABLE_ASSESSMENT_AUTOPSY', true),
  /** Enable full agentic engine loop */
  agentLoop: () => isEnabled('ENABLE_AGENT_LOOP', false),
}
