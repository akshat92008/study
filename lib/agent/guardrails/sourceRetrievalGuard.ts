import type { RetrievedSourceChunk } from '@/lib/agent/types';

export function assertSourceRetrievalVerified(input: {
  sourceRequested: boolean;
  knownSourceCount: number;
  chunks: RetrievedSourceChunk[];
}) {
  if (!input.sourceRequested) return;
  if (input.chunks.length > 0) return;
  if (input.knownSourceCount > 0) {
    throw new Error('Source exists but no retrievable chunks were verified.');
  }
}

