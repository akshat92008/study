import { z } from 'zod';
import { logger } from '@/lib/utils/logger';

interface APIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Normalizes userPrompt to a structured message array compatible with OpenAI format.
 * If userPrompt is a JSON-stringified array of messages (e.g. from GeminiProvider),
 * it parses it, maps 'model' to 'assistant', and returns the array.
 * Otherwise, it wraps the system instruction and user prompt as standard messages.
 */
function normalizeMessages(systemPrompt: string, userPrompt: string | any[]): APIMessage[] {
  const messages: APIMessage[] = [];

  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }

  if (Array.isArray(userPrompt)) {
    // Map objects to standard API format
    for (const msg of userPrompt) {
      const role = msg.role === 'model' ? 'assistant' : msg.role;
      messages.push({
        role: role === 'assistant' || role === 'system' ? role : 'user',
        content: msg.content || (typeof msg.parts === 'string' ? msg.parts : JSON.stringify(msg.parts || '')),
      });
    }
    return messages;
  }

  if (typeof userPrompt === 'string') {
    const trimmed = userPrompt.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          for (const msg of parsed) {
            const role = msg.role === 'model' ? 'assistant' : msg.role;
            messages.push({
              role: role === 'assistant' || role === 'system' ? role : 'user',
              content: msg.content || (typeof msg.parts === 'string' ? msg.parts : JSON.stringify(msg.parts || '')),
            });
          }
          return messages;
        }
      } catch {
        // Fall back to treating it as a raw string if parsing fails
      }
    }

    messages.push({ role: 'user', content: userPrompt });
  }

  return messages;
}

/**
 * Common fetch wrapper for sending requests to Groq/DeepSeek
 */
async function callOpenAICompatibleAPI(
  url: string,
  apiKey: string | undefined,
  body: any
): Promise<any> {
  if (!apiKey) {
    throw new Error('API key is not configured');
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API call failed with status ${response.status}: ${errorText}`);
  }

  return response;
}

function describeZodSchema(schema: any): string {
  if (!schema) return '';
  try {
    if (schema._def?.shape) {
      const shape = typeof schema._def.shape === 'function' ? schema._def.shape() : schema._def.shape;
      const keys = Object.keys(shape);
      const fields = keys.map(k => {
        const type = shape[k]?._def?.typeName || 'any';
        return `"${k}": ${type.replace('Zod', '').toLowerCase()}`;
      });
      return `{ ${fields.join(', ')} }`;
    }
  } catch {
    // Ignore and fallback
  }
  return '';
}

// ============================================================================
// GROQ FALLBACKS
// ============================================================================

export async function generateWithGroq(
  systemPrompt: string,
  userPrompt: string | any[],
  temperature: number = 0.7
): Promise<string> {
  logger.info('Attempting fallback text generation with Groq');
  const response = await callOpenAICompatibleAPI(
    'https://api.groq.com/openai/v1/chat/completions',
    process.env.GROQ_API_KEY,
    {
      model: 'llama-3.3-70b-versatile',
      messages: normalizeMessages(systemPrompt, userPrompt),
      max_tokens: 2048,
      temperature,
    }
  );
  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

export async function generateJSONWithGroq<T>(
  systemPrompt: string,
  userPrompt: string | any[],
  schema?: z.ZodSchema<T>,
  temperature: number = 0.3
): Promise<T> {
  logger.info('Attempting fallback JSON generation with Groq');
  
  // Groq requires the word 'json' to be in the messages when response_format is json_object
  let jsonSystemPrompt = systemPrompt.toLowerCase().includes('json')
    ? systemPrompt
    : `${systemPrompt}\n\nRespond ONLY with valid JSON.`;

  if (schema) {
    const shapeDesc = describeZodSchema(schema);
    if (shapeDesc) {
      jsonSystemPrompt += `\n\nYour JSON response must match this schema structure: ${shapeDesc}`;
    }
  }

  const response = await callOpenAICompatibleAPI(
    'https://api.groq.com/openai/v1/chat/completions',
    process.env.GROQ_API_KEY,
    {
      model: 'llama-3.3-70b-versatile',
      messages: normalizeMessages(jsonSystemPrompt, userPrompt),
      response_format: { type: 'json_object' },
      max_tokens: 4096,
      temperature,
    }
  );
  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '{}';
  const parsed = JSON.parse(text);
  
  if (schema) {
    return schema.parse(parsed);
  }
  return parsed as T;
}

export async function* streamWithGroq(
  systemPrompt: string,
  userPrompt: string | any[],
  temperature: number = 0.7
): AsyncGenerator<string> {
  logger.info('Attempting fallback text stream with Groq');
  const response = await callOpenAICompatibleAPI(
    'https://api.groq.com/openai/v1/chat/completions',
    process.env.GROQ_API_KEY,
    {
      model: 'llama-3.3-70b-versatile',
      messages: normalizeMessages(systemPrompt, userPrompt),
      max_tokens: 2048,
      temperature,
      stream: true,
    }
  );

  if (!response.body) {
    throw new Error('Response body is null');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (trimmed === 'data: [DONE]') continue;
        if (trimmed.startsWith('data: ')) {
          try {
            const parsed = JSON.parse(trimmed.slice(6));
            const content = parsed.choices?.[0]?.delta?.content || '';
            if (content) yield content;
          } catch {
            // Silence parsing errors for incomplete SSE chunks
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ============================================================================
// DEEPSEEK FALLBACKS
// ============================================================================

export async function generateWithDeepSeek(
  systemPrompt: string,
  userPrompt: string | any[],
  temperature: number = 0.7
): Promise<string> {
  logger.info('Attempting fallback text generation with DeepSeek');
  const response = await callOpenAICompatibleAPI(
    'https://api.deepseek.com/chat/completions',
    process.env.DEEPSEEK_API_KEY,
    {
      model: 'deepseek-chat',
      messages: normalizeMessages(systemPrompt, userPrompt),
      max_tokens: 2048,
      temperature,
    }
  );
  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

export async function generateJSONWithDeepSeek<T>(
  systemPrompt: string,
  userPrompt: string | any[],
  schema?: z.ZodSchema<T>,
  temperature: number = 0.3
): Promise<T> {
  logger.info('Attempting fallback JSON generation with DeepSeek');
  
  // Ensure the word 'json' is in the system prompt for format consistency
  let jsonSystemPrompt = systemPrompt.toLowerCase().includes('json')
    ? systemPrompt
    : `${systemPrompt}\n\nRespond ONLY with valid JSON.`;

  if (schema) {
    const shapeDesc = describeZodSchema(schema);
    if (shapeDesc) {
      jsonSystemPrompt += `\n\nYour JSON response must match this schema structure: ${shapeDesc}`;
    }
  }

  const response = await callOpenAICompatibleAPI(
    'https://api.deepseek.com/chat/completions',
    process.env.DEEPSEEK_API_KEY,
    {
      model: 'deepseek-chat',
      messages: normalizeMessages(jsonSystemPrompt, userPrompt),
      response_format: { type: 'json_object' },
      max_tokens: 4096,
      temperature,
    }
  );
  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '{}';
  const parsed = JSON.parse(text);

  if (schema) {
    return schema.parse(parsed);
  }
  return parsed as T;
}

export async function* streamWithDeepSeek(
  systemPrompt: string,
  userPrompt: string | any[],
  temperature: number = 0.7
): AsyncGenerator<string> {
  logger.info('Attempting fallback text stream with DeepSeek');
  const response = await callOpenAICompatibleAPI(
    'https://api.deepseek.com/chat/completions',
    process.env.DEEPSEEK_API_KEY,
    {
      model: 'deepseek-chat',
      messages: normalizeMessages(systemPrompt, userPrompt),
      max_tokens: 2048,
      temperature,
      stream: true,
    }
  );

  if (!response.body) {
    throw new Error('Response body is null');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (trimmed === 'data: [DONE]') continue;
        if (trimmed.startsWith('data: ')) {
          try {
            const parsed = JSON.parse(trimmed.slice(6));
            const content = parsed.choices?.[0]?.delta?.content || '';
            if (content) yield content;
          } catch {
            // Silence parsing errors for incomplete SSE chunks
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}