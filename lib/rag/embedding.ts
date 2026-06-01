import { getEmbedding } from '@/lib/ai/provider-client';

export async function embedRagText(
  text: string,
  options: { userId: string; route: string }
): Promise<number[]> {
  return getEmbedding(text, {
    userId: options.userId,
    feature: 'embedding',
    model: 'router:embedding',
    route: options.route,
  });
}
