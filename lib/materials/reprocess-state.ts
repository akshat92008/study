export function shouldQueueReprocess(status: string, force = false): boolean {
  return status !== 'processing' || force;
}

export function nextRetryCount(status: string, retryCount: number): number {
  return retryCount + (['failed', 'retryable_failed'].includes(status) ? 1 : 0);
}

export function reprocessJobKey(userId: string, materialId: string): string {
  return `rag_ingestion:${userId}:${materialId}`;
}

