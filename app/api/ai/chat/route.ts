// app/api/ai/chat/route.ts
// THE canonical chat route for Cognition OS. Replaces /api/ai/global and /api/ai/tutor.
// All chat traffic flows through here. One route, one brain.

import { NextRequest } from 'next/server';
import { after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { streamText, generateJSON, genai, getEmbedding } from '@/lib/ai/gemini';
import { getMINDContext } from '@/lib/engines/mind-engine';
import { getMINDSystemPrompt } from '@/lib/ai/prompts/mind-prompt';
import { updateConceptState } from '@/lib/engines/cognition-graph';
import { createSingleCard } from '@/lib/engines/revision-engine';
import { logger } from '@/lib/utils/logger';
import { resolveConceptByName } from '@/lib/engines/concept-resolver';
import { LearningStateEngine } from '@/lib/engines/learning-state-engine';
import { logPulseSignal } from '@/lib/engines/pulse-engine';
import { generateSessionClosingMessage } from '@/lib/engines/session-closing';
import { syncStudentModel } from '@/lib/engines/inference-engine';
import { generateSprintPlanAction } from '@/lib/actions/planner';
import { rateLimit } from '@/lib/utils/rate-limit';
import { Type } from '@google/genai';
import { z } from 'zod';

const encoder = new TextEncoder();

// ─── Image handler ────────────────────────────────────────────────────────────
async function handleImageMessage(
  imageBase64: string,
  imageMimeType: string,
  message: string,
  systemPrompt: string
): Promise<string> {
  const contents = [{
    role: 'user',
    parts: [
      { inlineData: { mimeType: imageMimeType, data: imageBase64 } },
      {
        text: `${message || 'Solve this question completely.'}\n\nInstructions:\n1. Identify what is shown in the image — question, diagram, handwriting, textbook page, etc.\n2. Solve it completely, step by step.\n3. Explain the core concept behind it.\n4. State how this topic typically appears in exams.\n5. Flag any common mistakes students make on this type of question.`
      }
    ]
  }];
  const response = await genai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents,
    config: { systemInstruction: systemPrompt, temperature: 0.4, maxOutputTokens: 4096 },
  });
  return response.text || 'Could not read the image clearly. Try a cleaner photo with better lighting.';
}

// ─── Intent detection schema ──────────────────────────────────────────────────
const IntentSchema = z.object({
  intent: z.enum([
    'TUTOR_SESSION',   // explain X, what is X, I don't understand X
    'PRACTICE',        // give me questions, test me, quiz me
    'CREATE_ARTIFACT', // make me a study guide / revision sheet / flashcards / plan
    'AUTOPSY',         // I gave a mock test, upload test
    'ANALYTICS',       // how am I doing, my progress, stats
    'ATLAS',           // my knowledge map, knowledge graph
    'FLASHCARDS',      // review flashcards, show me cards
    'REPLAN',          // I'm overwhelmed, change my plan
    'GENERAL_CHAT',    // hey, hi, how are you, casual
  ]),
  topic: z.string().optional(),
  subject: z.string().optional(),
});

// ─── Main route ───────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  // Rate limit: 120 messages/hour (generous for beta, prevents abuse)
  const allowed = await rateLimit(`chat-${user.id}`, 120, 60 * 60 * 1000);
  if (!allowed) {
    return new Response(
      JSON.stringify({ error: 'Rate limit reached. Please wait a moment.' }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let body: any;
  try { body = await req.json(); } catch { return new Response('Invalid JSON', { status: 400 }); }

  const { message, history, imageBase64, imageMimeType, activeGoalId } = body;

  // ── Build student context ──────────────────────────────────────────────────
  const mindContext = await getMINDContext(user.id, message);
  const systemPrompt = getMINDSystemPrompt(mindContext);

  // ── Image messages → direct multimodal response ────────────────────────────
  if (imageBase64 && imageMimeType) {
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const answer = await handleImageMessage(imageBase64, imageMimeType, message || '', systemPrompt);
          controller.enqueue(encoder.encode(answer));
        } catch (err) {
          controller.enqueue(encoder.encode('I had trouble reading that image. Try a clearer photo, or type the question out.'));
        }
        controller.close();
      }
    });
    return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }

  // ── Build Gemini conversation history (last 12 turns) ─────────────────────
  const geminiHistory = (history || []).slice(-12).map((m: any) => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content || '' }],
  }));
  geminiHistory.push({ role: 'user', parts: [{ text: message || '' }] });

  // ── Orchestrator: intent detection via function calling ───────────────────
  const orchestratorPrompt = buildOrchestratorPrompt(mindContext, user.id);
  const tools: any = buildOrchestratorTools();

  let orchestratorResponse: any;
  try {
    orchestratorResponse = await genai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: geminiHistory,
      config: { systemInstruction: orchestratorPrompt, tools, temperature: 0.15 },
    });
  } catch (err: any) {
    logger.error('Orchestrator failed', err);
    return new Response('AI service temporarily unavailable. Try again in a moment.', { status: 503 });
  }

  const functionCall = orchestratorResponse.functionCalls?.[0];
  const historyText = (history || []).slice(-8)
    .map((m: any) => `${m.role === 'user' ? 'Student' : 'Cognition'}: ${m.content}`)
    .join('\n');

  // ── Stream the response ────────────────────────────────────────────────────
  const stream = new ReadableStream({
    async start(controller) {
      let fullResponse = '';
      let metadataPayload: any = null;
      try {
        if (!functionCall) {
          const plainText = orchestratorResponse.text || 'How can I help?';
          controller.enqueue(encoder.encode(plainText));
          fullResponse = plainText;
        } else {
          const { name, args } = functionCall;

          // ── TUTOR SESSION ───────────────────────────────────────────────
          if (name === 'trigger_tutor_session') {
            const topic = (args as any).topic || 'General';
            const subject = (args as any).subject || 'General';

            const conceptId = await resolveConceptByName(user.id, subject, topic);
            const { data: mistakes } = await supabase.from('mistakes')
              .select('category, ai_analysis')
              .eq('user_id', user.id)
              .ilike('chapter', `%${topic}%`)
              .limit(5);

            let pastSessionCtx = '';
            if (conceptId) {
              const { data: pastSessions } = await supabase.from('tutor_sessions')
                .select('summary, started_at')
                .eq('user_id', user.id)
                .eq('concept_id', conceptId)
                .not('summary', 'is', null)
                .order('started_at', { ascending: false })
                .limit(3);

              if (pastSessions?.length) {
                pastSessionCtx = '\n\nPAST SESSIONS ON THIS TOPIC:\n' +
                  pastSessions.map((s: any) => `- [${new Date(s.started_at).toLocaleDateString()}] ${s.summary}`).join('\n');
              }
            }

            const tutorContext = `
Topic: ${subject} > ${topic}
Past Mistakes Here: ${mistakes?.map((m: any) => m.ai_analysis).join('; ') || 'None'}${pastSessionCtx}

Conversation so far:\n${historyText}\nStudent: ${message}`;

            for await (const chunk of streamText('flash', systemPrompt, tutorContext, 0.7)) {
              controller.enqueue(encoder.encode(chunk));
              fullResponse += chunk;
            }

            // Post-session processing (async)
            if (fullResponse.length > 100) {
              after(async () => {
                try {
                  const analysisPrompt = `Analyze this tutor exchange. Did the student demonstrate understanding?\n${historyText}\nStudent: ${message}\nTutor: ${fullResponse}\n\nRespond ONLY as JSON:\n{\"summary\":\"1 sentence summary\",\"understood\":true,\"gapFound\":\"question for flashcard front or null\",\"gapAnswer\":\"answer or null\"}`;
                  const analysis = await generateJSON<any>('flash', 'Expert analyzer. Return JSON only.', analysisPrompt);

                  if (conceptId) {
                    await updateConceptState(conceptId, analysis.understood, 0);
                    await supabase.from('tutor_sessions').insert({
                      user_id: user.id,
                      concept_id: conceptId || '',
                      summary: analysis.summary,
                      messages: [...(history || []), { role: 'user', content: message }, { role: 'assistant', content: fullResponse }],
                    });
                  }

                  if (!analysis.understood && typeof analysis.gapFound === 'string' && typeof analysis.gapAnswer === 'string' && conceptId) {
                    await createSingleCard(user.id, conceptId, analysis.gapFound, analysis.gapAnswer, subject, topic);
                  }

                  await LearningStateEngine.ingestEvent({
                    userId: user.id,
                    type: 'SESSION_COMPLETED',
                    data: { conceptId: conceptId ?? undefined, subject, chapter: topic, understandingGained: analysis.understood },
                  });

                  syncStudentModel(user.id).catch(() => {});
                } catch (err) {
                  logger.error('Post-session synthesis failed', err);
                }
              });
            }

            const closing = await generateSessionClosingMessage({
              userId: user.id,
              conceptId: conceptId || null,
              subject,
              chapter: topic,
              gapFound: null,
              gapAnswer: null,
              understood: true,
              turnsCount: history?.length || 0,
              oldMastery: null,
              newMastery: null,
              cardsCreated: 0,
              sessionId: `chat-${Date.now()}`,
            }).catch(() => null);

            if (closing) {
              metadataPayload = {
                action: 'session_closing_message',
                closingMessage: closing.text,
                closingType: closing.type,
                sessionComplete: true,
              };
            }

          // ── STUDY PLAN ---------------------------------------------------
          } else if (name === 'create_study_plan') {
            const target_date = (args as any).target_date;
            const { data: profile } = await supabase.from('profiles').select('study_hours_per_day').eq('id', user.id).single();
            const hoursPerDay = profile?.study_hours_per_day || 4;

            controller.enqueue(encoder.encode(`Building your personalised study plan for ${target_date}...\n\n`));

            const result = await generateSprintPlanAction(
              mindContext.weakConcepts.map((c: any) => c.subject),
              target_date,
              hoursPerDay
            );

            if (result.success) {
              controller.enqueue(encoder.encode(`Done. Your plan is ready — ${result.tasks?.length || 0} focused sessions mapped out.`));
              metadataPayload = { action: 'sprint_plan_created', tasks: result.tasks };
            } else {
              controller.enqueue(encoder.encode(`Could not generate plan right now: ${result.error}`));
            }

          // ── ROUTING ACTIONS (navigate to a feature) -----------------------
          } else {
            const routeMessages: Record<string, string> = {
              run_autopsy: "Opening **AUTOPSY** — upload your mock test PDF or photo. I’ll diagnose every wrong answer by root cause and show you your recoverable score.",
              show_flashcards: `You have **${mindContext.overdueCards}** cards due today. Opening your revision queue now.`,
              show_atlas: `Your knowledge map is at **${mindContext.masteryStats.masteryPercent}%** mastery. Opening ATLAS now.`,
              show_analytics: 'Opening your performance dashboard.',
              adjust_planner: 'Adjusting today’s workload based on your current state...',
            };
            const msg = routeMessages[name] || 'Opening that for you now...';
            controller.enqueue(encoder.encode(msg));
            metadataPayload = { action: name };
          }
        }

        // ── Persist chat memory (semantic layer) — non‑blocking ─────────────
        if (fullResponse.length > 50 && message) {
          after(async () => {
            try {
              const memoryContent = `Student asked: ${message}\nAnswer summary: ${fullResponse.slice(0, 400)}`;
              const embedding = await getEmbedding(memoryContent);
              if (embedding?.length) {
                await supabase.from('chat_memory_embeddings').insert({
                  user_id: user.id,
                  content: memoryContent,
                  embedding,
                });
              }
              await logPulseSignal(user.id, 'chat_interaction', {
                messageLength: message.length,
                responseLength: fullResponse.length,
                intent: functionCall?.name || 'general',
              });
            } catch (err) {
              logger.warn('Chat memory persist failed', err);
            }
          });
        }

        // ── Append metadata for client‑side handling ────────────────────────
        if (metadataPayload) {
          controller.enqueue(encoder.encode(`\n\n===METADATA===\n${JSON.stringify(metadataPayload)}`));
        }
      } catch (err: any) {
        logger.error('Chat stream error', err);
        controller.enqueue(encoder.encode('\n\n[Something went wrong. Please try again.]'));
      }
      controller.close();
    }
  });

  return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

// ── Orchestrator system prompt ─────────────────────────────────────────────────
function buildOrchestratorPrompt(ctx: any, _userId: string): string {
  const daysToExam = ctx.profile.examDate
    ? Math.ceil((new Date(ctx.profile.examDate).getTime() - Date.now()) / 86400000)
    : null;

  return `You are Cognition — the AI core of Cognition OS. Think of yourself as the student's most brilliant senior: one who has read every note they've uploaded, remembers every mistake they've made, knows their exam date, and is available at 3am.

STUDENT SNAPSHOT:
Name: ${ctx.profile.name}
Exam: ${ctx.profile.examType}
${daysToExam ? `Days remaining: ${daysToExam}` : ''}
Streak: ${ctx.profile.streakDays} days
Mastery: ${ctx.masteryStats.masteryPercent}% (${ctx.masteryStats.masteredCount}/${ctx.masteryStats.totalConcepts} concepts)
Overdue flashcards: ${ctx.overdueCards}
Emotional state: ${ctx.emotionalState}
Weak areas: ${ctx.weakConcepts.slice(0, 4).map((c: any) => c.name).join(', ') || 'Not mapped yet'}
Recent mistakes: ${ctx.recentMistakes.slice(0, 3).map((m: any) => `${m.chapter} (${m.category})`).join(', ') || 'None'}

ROUTING RULES:
- "explain X / what is X / I don't understand X" → trigger_tutor_session
- "give me questions / test me / quiz me" → trigger_tutor_session (with practice intent)
- "make a study guide / revision sheet / flashcard set / plan" → trigger_tutor_session (with artifact intent)
- "I gave a test / upload a test / check my mock" → run_autopsy
- "how am I doing / my stats / progress" → show_analytics
- "my knowledge map / ATLAS" → show_atlas
- "review flashcards / due cards" → show_flashcards
- "I'm overwhelmed / reduce my tasks" → adjust_planner
- "make a study plan / schedule" → create_study_plan
- "hey / hi / casual chat" → respond directly, NO function call. Pull one data point naturally.

PERSONALITY:
Direct, warm, specific. No filler. No "Great question!". No restating what they said.
For casual messages: respond in 1-2 sentences maximum, reference one real data point.
Example: "Hey! ${ctx.overdueCards} flashcards are due today — want to start there, or is something else on your mind?"`;
}

// ── Tool declarations ─────────────────────────────────────────────────────
function buildOrchestratorTools() {
  return [{
    functionDeclarations: [
      {
        name: 'trigger_tutor_session',
        description: 'Activates the MIND tutor engine. Use for any explanation, practice, or artifact generation request.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            topic: { type: Type.STRING, description: 'Specific concept or topic to cover' },
            subject: { type: Type.STRING, description: 'Subject area (Physics, Chemistry, Math, etc.)' },
          },
          required: ['topic'],
        },
      },
      {
        name: 'create_study_plan',
        description: 'Generates a personalised day‑by‑day study plan.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            target_date: { type: Type.STRING, description: 'Exam or target date (YYYY‑MM‑DD)' },
          },
          required: ['target_date'],
        },
      },
      {
        name: 'run_autopsy',
        description: 'Opens mock test autopsy upload. Use when student mentions a test they gave.',
        parameters: { type: Type.OBJECT, properties: {} },
      },
      {
        name: 'show_flashcards',
        description: 'Opens spaced repetition flashcard review.',
        parameters: { type: Type.OBJECT, properties: {} },
      },
      {
        name: 'show_atlas',
        description: 'Opens the ATLAS knowledge graph.',
        parameters: { type: Type.OBJECT, properties: {} },
      },
      {
        name: 'show_analytics',
        description: 'Opens performance analytics dashboard.',
        parameters: { type: Type.OBJECT, properties: {} },
      },
      {
        name: 'adjust_planner',
        description: 'Reduces daily workload when student signals overwhelm or fatigue.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            action: { type: Type.STRING, description: 'reduce_tasks | lighten_intensity | add_break' },
          },
          required: ['action'],
        },
      },
    ],
  }];
}
