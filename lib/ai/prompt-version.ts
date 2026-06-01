export type PromptSurface =
  | 'mind'
  | 'mentor'
  | 'tutor'
  | 'autopsy'
  | 'command'
  | 'briefing'
  | 'daily_synthesis'
  | 'concept_expansion'
  | 'revision_card';

const DEFAULT_PROMPT_VERSION = 'v1';

export function getPromptVersion(surface: PromptSurface): string {
  const primaryKey = `${surface.toUpperCase()}_PROMPT_VERSION`;
  const legacyKey = `PROMPT_VERSION_${surface.toUpperCase()}`;
  return (
    process.env[primaryKey] ||
    process.env.DEFAULT_PROMPT_VERSION ||
    process.env[legacyKey] ||
    process.env.PROMPT_VERSION_DEFAULT ||
    DEFAULT_PROMPT_VERSION
  );
}
