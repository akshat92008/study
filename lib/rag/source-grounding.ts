export type SourceGroundingState = 'ready' | 'processing' | 'failed' | 'none';

export function getSourceGroundingState(statuses: string[]): SourceGroundingState {
  if (statuses.includes('ready')) return 'ready';
  if (statuses.some((status) => ['uploaded', 'queued', 'processing', 'parsed', 'embedding'].includes(status))) return 'processing';
  if (statuses.some((status) => ['failed', 'retryable_failed', 'needs_user_action'].includes(status))) return 'failed';
  return 'none';
}

