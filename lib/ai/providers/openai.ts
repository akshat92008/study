import OpenAI from 'openai';

const openai = process.env.OPENAI_API_KEY 
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export async function openaiFallback(params: {
  prompt: string;
  systemPrompt?: string;
  model?: string;
}): Promise<string> {
  if (!openai) throw new Error('OpenAI fallback not configured');
  
  const completion = await openai.chat.completions.create({
    model: params.model || 'gpt-4o-mini',  // cheap fallback
    messages: [
      ...(params.systemPrompt ? [{ role: 'system' as const, content: params.systemPrompt }] : []),
      { role: 'user' as const, content: params.prompt },
    ],
    max_tokens: 2000,
  });
  
  return completion.choices[0]?.message?.content || '';
}
