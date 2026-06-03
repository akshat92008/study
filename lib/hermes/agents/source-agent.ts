// lib/hermes/agents/source-agent.ts
// HERMES SOURCE AGENT
//
// Processes study material after upload to extract learning metadata.
// DISABLED by default — only activates when HERMES_SOURCE_PROCESSING_ENABLED=true.
// Does NOT block upload responses.
// Processes only compact chunks (max 5), never full PDF content.

import { runHermesJSON } from '../hermes-client';
import { HermesSourceResultSchema } from '../schemas/source.schema';
import {
  HERMES_SOURCE_SYSTEM_PROMPT,
  buildSourceUserPrompt,
} from '../hermes-prompts';
import type { HermesSourceInput, HermesSourceResult } from '../hermes-types';
import { hermesLogger } from '../hermes-logger';
import { getHermesConfig, isHermesEnabled } from '../hermes-config';
import { HermesDisabledError } from '../hermes-errors';
import { compactArray, truncate } from '../hermes-internal-utils';

// Hard limit: never send more than this many chars per chunk to avoid token bloat
const MAX_CHARS_PER_CHUNK = 1000;
// Hard limit: never process more chunks than this
const MAX_CHUNKS = 5;

export async function runHermesSourceAgent(
  input: HermesSourceInput
): Promise<HermesSourceResult> {
  if (!isHermesEnabled()) {
    throw new HermesDisabledError();
  }

  const config = getHermesConfig();
  if (!config.sourceProcessingEnabled) {
    throw new HermesDisabledError();
  }

  if (!input.compactChunks || input.compactChunks.length === 0) {
    throw new Error('Hermes source agent: no content chunks provided');
  }

  // Cost control: limit to first N chunks, truncate each
  const compactChunks = compactArray(input.compactChunks, MAX_CHUNKS)
    .map(chunk => truncate(chunk, MAX_CHARS_PER_CHUNK));

  const userPrompt = buildSourceUserPrompt({
    title: input.title,
    goalTitle: input.goalTitle,
    chunks: compactChunks,
  });

  hermesLogger.info('Source agent called', {
    userId: input.userId,
    materialId: input.materialId,
    goalId: input.goalId,
    chunkCount: compactChunks.length,
  });

  return runHermesJSON<HermesSourceResult>({
    userId: input.userId,
    feature: 'hermes_source',
    route: '/api/materials/upload',
    systemPrompt: HERMES_SOURCE_SYSTEM_PROMPT,
    userPrompt,
    schema: HermesSourceResultSchema,
    modelTier: 'fast',
    metadata: {
      materialId: input.materialId,
      goalId: input.goalId ?? null,
    },
  });
}
