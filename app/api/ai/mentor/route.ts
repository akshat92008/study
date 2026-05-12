import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { streamMentorResponse } from '@/lib/ai/agents/mentor';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { message, history } = await req.json();

  // Save user message
  await supabase.from('mentor_chats').insert({
    user_id: user.id, role: 'user', content: message,
  });

  // Stream response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let fullResponse = '';
      try {
        for await (const chunk of streamMentorResponse(user.id, message, history || [])) {
          fullResponse += chunk;
          controller.enqueue(encoder.encode(chunk));
        }
        // Save mentor response
        await supabase.from('mentor_chats').insert({
          user_id: user.id, role: 'mentor', content: fullResponse,
        });
      } catch (error) {
        controller.enqueue(encoder.encode('\n\n[Error generating response]'));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Transfer-Encoding': 'chunked' },
  });
}
