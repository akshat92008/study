import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { streamText, generateJSON } from '@/lib/ai/gemini';
import { getMINDContext } from '@/lib/engines/mind-engine';
import { getMINDSystemPrompt, buildMINDUserPrompt } from '@/lib/ai/prompts/mind-prompt';
import { updateConceptState } from '@/lib/engines/cognition-graph';
import { createSingleCard } from '@/lib/engines/revision-engine';
import { logger } from '@/lib/utils/logger';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response('Unauthorized', { status: 401 });

    const { message, history, currentPath } = await req.json();

    // 1. Fetch 6-dimensional MIND context (Goal, Struggles, History, Weak Concepts, RAG, etc.)
    const mindContext = await getMINDContext(user.id, message);

    // 2. Construct the Socratic Prompt
    const systemPrompt = getMINDSystemPrompt(mindContext, currentPath || '/dashboard');

    // 3. Format history for user prompt
    const historyText = (history || [])
      .slice(-10)
      .map((m: any) => `${m.role === 'user' ? 'Student' : 'MIND'}: ${m.content}`)
      .join('\n');

    const userPrompt = buildMINDUserPrompt(historyText, message);

    const encoder = new TextEncoder();
    let fullResponse = '';

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Use gemini-2.5-pro for complex Socratic reasoning & learning coach behaviors
          const generator = streamText('pro', systemPrompt, userPrompt, 0.75);
          for await (const chunk of generator) {
            controller.enqueue(encoder.encode(chunk));
            fullResponse += chunk;
          }
        } catch (err: any) {
          logger.error('Error during MIND streaming', err);
          controller.enqueue(encoder.encode('\n\n[MIND engine is temporarily adjusting its parameters. Please try again.]'));
        } finally {
          controller.close();

          // 4. Background Post-Session Cognitive Synthesis
          if (fullResponse.trim().length > 0) {
            Promise.resolve().then(async () => {
              try {
                const recentHistoryText = [
                  ...historyText.split('\n'),
                  `Student: ${message}`,
                  `MIND: ${fullResponse}`
                ].slice(-6).join('\n');

                const analysisPrompt = `Analyze the student's recent exchange with the AI MIND tutor to check if they were studying/discussing a specific academic concept.
If yes, identify the broad subject (e.g. 'Physics', 'Chemistry'), the name of the concept (e.g. 'Coulomb\'s Law'), check if they demonstrated clear understanding of it, and if any critical conceptual gaps or confusion were found.

Exchange:
${recentHistoryText}

Respond STRICTLY in JSON format with these exact fields:
{
  "conceptDiscussed": boolean,
  "subject": string | null,
  "conceptName": string | null,
  "understandingGained": boolean,
  "gapFound": string | null,
  "gapAnswer": string | null,
  "summary": string
}`;

                const analysis = await generateJSON<any>(
                  'flash',
                  'You are an expert learning diagnostic engine.',
                  analysisPrompt
                );

                if (!analysis) return;

                let conceptId: string | null = null;
                const db = await createClient();

                // If concept was discussed, try to resolve it in database
                if (analysis.conceptDiscussed && analysis.subject && analysis.conceptName) {
                  const { data: matchedConcept } = await db
                    .from('concepts')
                    .select('id, name, subject')
                    .eq('user_id', user.id)
                    .eq('subject', analysis.subject)
                    .ilike('name', `%${analysis.conceptName}%`)
                    .limit(1)
                    .maybeSingle();

                  if (matchedConcept) {
                    conceptId = matchedConcept.id;
                  } else {
                    const { data: fallbackConcept } = await db
                      .from('concepts')
                      .select('id, name, subject')
                      .eq('user_id', user.id)
                      .ilike('name', `%${analysis.conceptName}%`)
                      .limit(1)
                      .maybeSingle();
                    if (fallbackConcept) conceptId = fallbackConcept.id;
                  }
                }

                // Write Socratic Session to Database for longitudinal memory
                const currentHistoryMessages = [
                  ...(history || []),
                  { role: 'user', content: message },
                  { role: 'tutor', content: fullResponse }
                ];

                await db.from('tutor_sessions').insert({
                  user_id: user.id,
                  concept_id: conceptId,
                  messages: currentHistoryMessages,
                  summary: analysis.summary || 'Study discussion.',
                  understanding_gained: analysis.understandingGained ? 1 : 0
                });

                // Update mastery state in ATLAS
                if (conceptId && analysis.understandingGained) {
                  await updateConceptState(conceptId, true, 0);
                }

                // Seed flashcards in MEMORY for conceptual gaps
                if (conceptId && analysis.gapFound && !analysis.understandingGained) {
                  await createSingleCard(
                    user.id,
                    conceptId,
                    analysis.gapFound,
                    analysis.gapAnswer || 'Check source notes.',
                    analysis.subject || 'General',
                    analysis.conceptName || 'Discussion'
                  );
                }
              } catch (bgErr) {
                logger.error('Error during post-session background synthesis', bgErr);
              }
            });
          }
        }
      },
    });

    return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  } catch (error: any) {
    logger.error('Critical failure in MIND global assistant route', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
