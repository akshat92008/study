import { GoogleGenAI } from '@google/genai';

if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY environment variable is required');
}

export const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Model references
export const MODELS = {
  // Use Flash for fast, cheap operations (classification, extraction, simple Q&A)
  flash: 'gemini-2.5-flash',
  // Use Pro for complex reasoning (analysis, strategy, mentoring)
  pro: 'gemini-2.5-pro-preview-06-05',
} as const;

// Helper to generate text with a specific model
export async function generateText(
  model: keyof typeof MODELS,
  systemPrompt: string,
  userPrompt: string,
  temperature: number = 0.7
): Promise<string> {
  const response = await genai.models.generateContent({
    model: MODELS[model],
    contents: userPrompt,
    config: {
      systemInstruction: systemPrompt,
      temperature,
      maxOutputTokens: 8192,
    },
  });

  return response.text ?? '';
}

// Helper to generate JSON with a specific model
export async function generateJSON<T>(
  model: keyof typeof MODELS,
  systemPrompt: string,
  userPrompt: string,
  temperature: number = 0.3
): Promise<T> {
  const response = await genai.models.generateContent({
    model: MODELS[model],
    contents: userPrompt,
    config: {
      systemInstruction: systemPrompt + '\n\nRespond ONLY with valid JSON. No markdown, no code fences, no explanation.',
      temperature,
      responseMimeType: 'application/json',
    },
  });

  const text = response.text ?? '{}';
  return JSON.parse(text) as T;
}

// Helper for streaming responses (used in chat interfaces)
export async function* streamText(
  model: keyof typeof MODELS,
  systemPrompt: string,
  userPrompt: string,
  temperature: number = 0.7
): AsyncGenerator<string> {
  const response = await genai.models.generateContentStream({
    model: MODELS[model],
    contents: userPrompt,
    config: {
      systemInstruction: systemPrompt,
      temperature,
      maxOutputTokens: 8192,
    },
  });

  for await (const chunk of response) {
    if (chunk.text) {
      yield chunk.text;
    }
  }
}
