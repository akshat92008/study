export function isEnabled(name: string, defaultValue = false): boolean {
  const value = process.env[name]

  if (value == null || value === '') {
    return defaultValue
  }

  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())
}

export const featureFlags = {
  visionUploads: () => isEnabled('ENABLE_VISION_UPLOADS', false),
  ragIngestion: () => isEnabled('ENABLE_RAG_INGESTION', true),
  autopsyProcessing: () => isEnabled('ENABLE_AUTOPSY_PROCESSING', true),
  agentActions: () => isEnabled('ENABLE_AGENT_ACTIONS', true),
  aiEscalation: () => isEnabled('ENABLE_AI_ESCALATION', true),
}
