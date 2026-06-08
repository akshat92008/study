export const FeatureFlags = {
  // Enabled features for 10-user private alpha
  ENABLE_CHAT: true,
  ENABLE_PRACTICE: true,
  ENABLE_RAG_UPLOAD: true,

  // Disabled features (unbuilt or omitted from MVP)
  ENABLE_AUTOPSY_UI: true,
  ENABLE_ANALYTICS_UI: false,
  ENABLE_ATLAS_UI: false,
  ENABLE_FLASHCARDS_UI: true, // Re-enabled for MVP (Revision)
  ENABLE_VOICE_CHAT: false,
  ENABLE_KNOWLEDGE_UI: true,
};

export function isFeatureEnabled(featureName: keyof typeof FeatureFlags): boolean {
  return FeatureFlags[featureName];
}
