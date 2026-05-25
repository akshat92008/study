// lib/ai/gemini.ts
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
} from './router';

// Kept for backward compatibility — some files import these
export const genai = null as any;
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
  return routeJSONGeneration<T>(systemPrompt, userPrompt, temperature);
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
  try {
    return await routeEmbedding(text);
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
