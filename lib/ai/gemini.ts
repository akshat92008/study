// lib/ai/gemini.ts
// DEPRECATED: This file is kept temporarily for backward compatibility.
// It does NOT mean Gemini-only routing; it simply forwards to the provider client.
// Please use @/lib/ai/provider-client for all new imports.

import {
  MODELS,
  generateText,
  generateJSON,
  streamText,
  getEmbedding,
  handleVisionMessage,
} from './provider-client';

export const genai = null as any;

export {
  MODELS,
  generateText,
  generateJSON,
  streamText,
  getEmbedding,
  handleVisionMessage,
};
