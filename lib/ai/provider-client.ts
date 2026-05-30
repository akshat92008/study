// lib/ai/provider-client.ts
// All AI calls now route through the provider router.
// This file maintains the same function signatures as before
// so nothing else in the codebase needs to change.

import { z } from 'zod';
import { logger } from '@/lib/utils/logger';
import {
  routeTextGeneration,
  routeJSONGeneration,
  routeStreamGeneration,
  routeEmbedding,
  routeVisionCall,
  routeMultimodalJSONExtraction,
  routeAudioSynthesis,
} from './router';

export const MODELS = {
  flash: 'fast',
  pro: 'quality',
  flashVision: 'vision',
  fallback: 'fast',
} as const;

export async function generateText(
  _model: keyof typeof MODELS,
  systemPrompt: string,
  userPrompt: string,
  temperature = 0.7
): Promise<string> {
  return routeTextGeneration('chat', systemPrompt, userPrompt, temperature);
}

export async function generateJSON<T>(
  _model: keyof typeof MODELS,
  systemPrompt: string,
  userPrompt: string,
  _schema?: z.ZodSchema<T>,
  temperature = 0.3,
  _retries = 3
): Promise<T> {
  return routeJSONGeneration<T>(systemPrompt, userPrompt, temperature, _schema);
}

export async function* streamText(
  _model: keyof typeof MODELS,
  systemPrompt: string,
  userPrompt: string | any[],
  temperature = 0.7
): AsyncGenerator<string> {
  const prompt = Array.isArray(userPrompt)
    ? userPrompt
    : userPrompt;

  yield* routeStreamGeneration(systemPrompt, prompt as any, temperature);
}

export async function getEmbedding(text: string): Promise<number[]> {
  // Guard: if embeddings are disabled, return empty array.
  // ChatMemoryService.storeMessageInMemory already handles empty embedding gracefully.
  if (process.env.DISABLE_EMBEDDINGS === 'true') {
    return [];
  }
  if (!text || text.trim().length < 3) return [];
  try {
    return await routeEmbedding(text.slice(0, 8000));
  } catch (err) {
    logger.warn('getEmbedding failed silently', err);
    return [];
  }
}

export async function handleVisionMessage(
  imageBase64: string,
  imageMimeType: string,
  message: string,
  systemPrompt: string
): Promise<string> {
  return routeVisionCall(systemPrompt, imageBase64, imageMimeType, message);
}

export async function generateMultimodalJSON<T>(
  systemPrompt: string,
  fileData: { mimeType: string; data: string },
  schema?: z.ZodSchema<T>
): Promise<T> {
  return routeMultimodalJSONExtraction<T>(systemPrompt, fileData, schema);
}

export async function synthesizeSpeech(script: string): Promise<string | null> {
  return routeAudioSynthesis(script);
}
