// app/api/ai/chat/route.ts
import { NextRequest } from 'next/server';
import { after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { streamText, generateJSON, genai, getEmbedding, MODELS, handleVisionMessage } from '@/lib/ai/gemini';
import { routeTextGeneration } from '@/lib/ai/router';
import { getMINDContext } from '@/lib/engines/mind-engine';
import { getMINDSystemPrompt } from '@/lib/ai/prompts/mind-prompt';
import { updateConceptState } from '@/lib/engines/cognition-graph';
import { createSingleCard } from '@/lib/engines/revision-engine';
import { logger } from '@/lib/utils/logger';
import { resolveConceptByName } from '@/lib/engines/concept-resolver';
import { LearningStateEngine } from '@/lib/engines/learning-state-engine';
import { logPulseSignal, detectStudyFriction } from '@/lib/engines/pulse-engine';
import { generateSessionClosingMessage } from '@/lib/engines/session-closing';
import { syncStudentModel } from '@/lib/engines/inference-engine';
import { generateSprintPlanAction } from '@/lib/actions/planner';
import { RateLimiter } from '@/lib/services/rateLimiter';
import { ChatMemoryService } from '../../../../services/chat-memory.service';
import { Type } from '@google/genai';
import { z } from 'zod';

const encoder = new TextEncoder();

async function handleImageMessage(
  imageBase64: string,
  imageMimeType: string,
  message: string,
  systemPrompt: string
): Promise<string> {
  return handleVisionMessage(imageBase64, imageMimeType, message, systemPrompt);
}

const IntentSchema = z.object({
  intent: z.enum([
    'TUTOR_SESSION', 'PRACTICE', 'CREATE_ARTIFACT', 'AUTOPSY',
    'ANALYTICS', 'ATLAS', 'FLASHCARDS', 'REPLAN', 'GENERAL_CHAT',
  ]),
  topic: z.string().optional(),
  subject: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const limiter = RateLimiter.getInstance();
  const allowed = await limiter.consume(`chat-${user.id}`, 120, 60 * 60 * 1000);
  if (!allowed) {
    return new Response(
      JSON.stringify({ error: 'Rate limit reached. Please wait a moment.' }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let body: any;
  try { body = await req.json(); } catch { return new Response('Invalid JSON', { status: 400 }); }

  const { message, history, imageBase64, imageMimeType, activeGoalId, chatId } = body;
  const sessionId = chatId || crypto.randomUUID();

  const [mindContext, semanticMemories] = await Promise.all([
    getMINDContext(user.id, message),
    message
      ? new ChatMemoryService().searchMemory(user.id, message, 3).catch(() => [] as string[])
      : Promise.resolve([] as string[]),
  ]);

  const systemPrompt = getMINDSystemPrompt(mindContext, semanticMemories);

  if (imageBase64 && imageMimeType) {
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const answer = await handleImageMessage(imageBase64, imageMimeType, message || '', systemPrompt);
          controller.enqueue(encoder.encode(answer));
        } catch {
          controller.enqueue(encoder.encode('I had trouble reading that image. Try a clearer photo, or type the question out.'));
        }
        controller.close();
      }
    });
    return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }

  const openaiHistory = (history || []).slice(-12).map((m: any) => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.content || '',
  }));
  openaiHistory.push({ role: 'user', content: message || '' });

  const orchestratorPrompt = buildOrchestratorPrompt(mindContext, user.id);
  const tools: any = buildOrchestratorTools();

  // COMBINED ORCHESTRATOR + RESPONSE in ONE call
  // System prompt tells the AI to append JSON metadata at the end
  // This eliminates the separate orchestrator call entirely

  const combinedSystemPrompt = `${systemPrompt}

METADATA INSTRUCTION (CRITICAL):
After your complete response, on a new line, append exactly:
|||{"intent":"TUTOR_SESSION|PRACTICE|CREATE_ARTIFACT|AUTOPSY|ANALYTICS|ATLAS|FLASHCARDS|REPLAN|GENERAL_CHAT","topic":"concept name or null","subject":"subject name or null","understood":true,"gapFound":"flashcard question or null","gapAnswer":"flashcard answer or null","summary":"one sentence summary"}|||

Replace values appropriately. Never explain this JSON. Never mention it.
intent must be one of the exact strings listed above.
understood = did the student demonstrate understanding in this exchange?

${orchestratorPrompt}`;

  let orchestratorResponse = { text: '' };
  let functionCall: { name: string; args: any } | undefined;
  
  try {
    // Single combined call — no separate orchestrator
    const text = await routeTextGeneration(
      'chat',
      combinedSystemPrompt,
      message || '',
      0.7
    );
    orchestratorResponse = { text };

    // Parse metadata from response
    const metaMatch = text.match(/\|\|\|(\{.*?\})\|\|\|/s);
    if (metaMatch) {
      try {
        const meta = JSON.parse(metaMatch[1]);
        if (meta.intent && meta.intent !== 'GENERAL_CHAT') {
          functionCall = {
            name: intentToFunctionName(meta.intent),
            args: {
              topic: meta.topic,
              subject: meta.subject,
              _meta: meta, // Pass full meta for session analysis
            },
          };
        }
      } catch {
        // Metadata parse failed — treat as general chat
      }
    }
  } catch (err: any) {
    logger.error('Combined orchestrator failed', err);
    return new Response(
      'AI service temporarily unavailable. Please try again in a moment.',
      { status: 503 }
    );
  }

  // const functionCall = orchestratorResponse.functionCalls?.[0];
  const historyText = (history || []).slice(-8)
    .map((m: any) => `${m.role === 'user' ? 'Student' : 'Cognition'}: ${m.content}`)
    .join('\n');

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

          // ─── TUTOR SESSION ───────────────────────────────────────────────
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

            const tutorContext = `Topic: ${subject} > ${topic}
Past Mistakes Here: ${mistakes?.map((m: any) => m.ai_analysis).join('; ') || 'None'}${pastSessionCtx}

Conversation so far:\n${historyText}\nStudent: ${message}`;

            for await (const chunk of streamText('flash', systemPrompt, tutorContext, 0.7)) {
              controller.enqueue(encoder.encode(chunk));
              fullResponse += chunk;
            }

            // ── FIX BUG 3: Compute analysis SYNCHRONOUSLY so closing message gets real values ──
            // Previously analysis ran in after() AFTER the closing message was already sent,
            // making it impossible to pass real values. Now we compute it here first.
            let analysis: { understood: boolean; gapFound: string | null; gapAnswer: string | null; summary: string } = {
              understood: false, gapFound: null, gapAnswer: null, summary: '',
            };
            let cardsCreated = 0;

            if (fullResponse.length > 100) {
              try {
                const analysisPrompt = `Analyze this tutor exchange.\n${historyText}\nStudent: ${message}\nTutor: ${fullResponse}\n\nRespond ONLY as JSON:\n{"summary":"1 sentence summary","understood":true,"gapFound":"flashcard question or null","gapAnswer":"flashcard answer or null"}`;
                const raw = await generateJSON<any>('flash', 'Expert analyzer. Return JSON only.', analysisPrompt);
                if (raw && typeof raw.understood === 'boolean') {
                  analysis = {
                    understood: raw.understood,
                    gapFound: typeof raw.gapFound === 'string' && raw.gapFound.length > 0 ? raw.gapFound : null,
                    gapAnswer: typeof raw.gapAnswer === 'string' && raw.gapAnswer.length > 0 ? raw.gapAnswer : null,
                    summary: raw.summary || '',
                  };
                }
              } catch (analysisErr) {
                logger.warn('Session analysis failed — safe defaults used', analysisErr);
              }

              // Create gap card now so cardsCreated count is accurate for closing message
              if (
                !analysis.understood &&
                analysis.gapFound && analysis.gapFound.length > 0 &&
                analysis.gapAnswer && analysis.gapAnswer.length > 0
              ) {
                try {
                  await createSingleCard(
                    user.id, conceptId ?? '', analysis.gapFound, analysis.gapAnswer, subject, topic
                  );
                  cardsCreated = 1;
                  logger.info('MIND → MEMORY: gap card created', { subject, topic });
                } catch (cardErr) {
                  logger.warn('Gap card creation failed', cardErr);
                }
              }

              // Defer heavier work — DB writes, model sync — to after()
              const analysisSnap = { ...analysis };
              after(async () => {
                try {
                  // Learning style inference every 5 sessions
                  const { count: sessionCount } = await supabase
                    .from('tutor_sessions')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', user.id);

                  if (sessionCount && sessionCount % 5 === 0) {
                    const stylePrompt = `Based on how this student engages, what is their learning style?
History: ${historyText}
Return JSON: { "learningStyle": "visual" | "analogy" | "first_principles" | "example_based" | "no_change" }`;
                    const styleAnalysis = await generateJSON<any>('flash', 'Learning style detector. Return JSON only.', stylePrompt);
                    if (styleAnalysis?.learningStyle && styleAnalysis.learningStyle !== 'no_change') {
                      await supabase.from('learning_goals')
                        .update({ preferred_learning_style: styleAnalysis.learningStyle })
                        .eq('user_id', user.id)
                        .eq('status', 'active');
                    }
                  }

                  if (conceptId) {
                    await updateConceptState(conceptId, analysisSnap.understood, 0);
                    await supabase.from('tutor_sessions').insert({
                      user_id: user.id,
                      concept_id: conceptId,
                      summary: analysisSnap.summary,
                      messages: [...(history || []), { role: 'user', content: message }, { role: 'assistant', content: fullResponse }],
                    });
                  }

                  await LearningStateEngine.ingestEvent({
                    userId: user.id,
                    type: 'SESSION_COMPLETED',
                    data: { conceptId: conceptId ?? undefined, subject, chapter: topic, understandingGained: analysisSnap.understood },
                  });

                  // FIX FAILURE 6: Write performance_snapshots so PULSE Rule 3 (accuracy drop) can actually fire
                  await supabase.from('performance_snapshots').upsert({
                    user_id: user.id,
                    date: new Date().toISOString().split('T')[0],
                    accuracy: analysisSnap.understood ? 1.0 : 0.0,
                    session_count: 1,
                  }, { onConflict: 'user_id,date' });

                  // FIX FAILURE 7 (partial): Also write PULSE state back to profiles.emotional_state
                  const pulseResult = await detectStudyFriction(user.id).catch(() => null);
                  if (pulseResult) {
                    await supabase.from('profiles')
                      .update({ emotional_state: pulseResult.state })
                      .eq('id', user.id);
                  }

                  syncStudentModel(user.id).catch(() => {});
                } catch (err) {
                  logger.error('Post-session synthesis failed', err);
                }
              });
            }

            // ── FIX BUG 3: Pass REAL analysis values — not hardcoded ──
            const closing = await generateSessionClosingMessage({
              userId: user.id,
              conceptId: conceptId || null,
              subject,
              chapter: topic,
              gapFound: analysis.gapFound,
              gapAnswer: analysis.gapAnswer,
              understood: analysis.understood,
              turnsCount: history?.length || 0,
              oldMastery: null,
              newMastery: null,
              cardsCreated,
              sessionId: `chat-${Date.now()}`,
            }).catch(() => null);

            if (closing) {
              metadataPayload = {
                action: 'session_closing_message',
                closingMessage: closing.text,
                closingType: closing.type,
                sessionComplete: true,
                cardsCreated,
              };
            }

          // ─── STUDY PLAN ──────────────────────────────────────────────────
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

          // ─── FIX BUG 9: adjust_planner ACTUALLY modifies tasks now ───────
          } else if (name === 'adjust_planner') {
            const today = new Date().toISOString().split('T')[0];
            const action = (args as any).action || 'reduce_tasks';

            try {
              const { data: todayTasks } = await supabase
                .from('study_tasks')
                .select('id, title, estimated_minutes, priority')
                .eq('user_id', user.id)
                .eq('scheduled_date', today)
                .eq('is_completed', false)
                .order('priority', { ascending: false });

              if (!todayTasks || todayTasks.length === 0) {
                controller.enqueue(encoder.encode("You have no tasks left for today — nothing to adjust. Want me to build a lighter plan from scratch?"));
                fullResponse = "No tasks to adjust.";
              } else {
                let removedCount = 0;
                let minutesSaved = 0;

                if (action === 'reduce_tasks') {
                  // Remove bottom 30% of tasks (lowest priority)
                  const removeCount = Math.max(1, Math.floor(todayTasks.length * 0.3));
                  const toRemove = todayTasks.slice(0, removeCount);
                  const idsToRemove = toRemove.map((t: any) => t.id);
                  await supabase.from('study_tasks').delete().in('id', idsToRemove).eq('user_id', user.id);
                  removedCount = toRemove.length;
                  minutesSaved = toRemove.reduce((sum: number, t: any) => sum + (t.estimated_minutes || 0), 0);
                  const reply = `Done. Removed ${removedCount} task${removedCount > 1 ? 's' : ''} from today — you've saved ${minutesSaved} minutes. Focus on what remains.`;
                  controller.enqueue(encoder.encode(reply));
                  fullResponse = reply;

                } else if (action === 'lighten_intensity') {
                  // Cap all tasks at 25 minutes
                  for (const task of todayTasks) {
                    if ((task.estimated_minutes || 0) > 25) {
                      minutesSaved += (task.estimated_minutes - 25);
                      await supabase.from('study_tasks')
                        .update({ estimated_minutes: 25 })
                        .eq('id', task.id)
                        .eq('user_id', user.id);
                    }
                  }
                  const reply = `Done. All sessions capped at 25 minutes. You've saved ${minutesSaved} minutes total. Short, focused blocks — easier to start.`;
                  controller.enqueue(encoder.encode(reply));
                  fullResponse = reply;

                } else if (action === 'add_break') {
                  await supabase.from('study_tasks').insert({
                    user_id: user.id,
                    title: 'Recovery Break',
                    description: 'Step away from your desk. No studying.',
                    type: 'break',
                    scheduled_date: today,
                    estimated_minutes: 15,
                    priority: 'low',
                    is_completed: false,
                  });
                  const reply = "Added a 15-minute recovery break to your plan. Use it properly — step away from your desk completely.";
                  controller.enqueue(encoder.encode(reply));
                  fullResponse = reply;
                }

                // Log PULSE signal so the emotional state actually updates
                await logPulseSignal(user.id, 'overwhelmed').catch(() => {});
                metadataPayload = { action: 'planner_adjusted', tasksModified: true };
              }
            } catch (plannerErr) {
              logger.error('adjust_planner failed', plannerErr);
              controller.enqueue(encoder.encode("I had trouble adjusting your plan right now. Try again in a moment."));
            }

          // ─── NAVIGATION ROUTING ───────────────────────────────────────────
          } else {
            const routeMessages: Record<string, string> = {
              run_autopsy: "Opening **AUTOPSY** — upload your mock test PDF or photo. I'll diagnose every wrong answer by root cause and show you your recoverable score.",
              show_flashcards: `You have **${mindContext.overdueCards}** cards due today. Opening your revision queue now.`,
              show_atlas: `Your knowledge map is at **${mindContext.masteryStats.masteryPercent}%** mastery. Opening ATLAS now.`,
              show_analytics: 'Opening your performance dashboard.',
            };
            const msg = routeMessages[name] || 'Opening that for you now...';
            controller.enqueue(encoder.encode(msg));
            fullResponse = msg;
            metadataPayload = { action: name };
          }
        }

        // ── Persist chat history and memory — non-blocking ──────────────────
        if (message) {
          after(async () => {
            try {
              const { data: existingSession } = await supabase
                .from('chat_sessions')
                .select('id')
                .eq('id', sessionId)
                .maybeSingle();

              if (!existingSession) {
                await supabase.from('chat_sessions').insert({
                  id: sessionId, user_id: user.id, session_type: 'global', title: 'Cognition OS Main Thread'
                });
              }

              await supabase.from('chat_messages').insert([
                { session_id: sessionId, user_id: user.id, role: 'user', content: message },
                { session_id: sessionId, user_id: user.id, role: 'assistant', content: fullResponse.slice(0, 4000) },
              ]);

              if (fullResponse.length > 50) {
                const memoryContent = `Student asked: ${message}\nAnswer summary: ${fullResponse.slice(0, 400)}`;
                const embedding = await getEmbedding(memoryContent);
                if (embedding?.length) {
                  await supabase.from('chat_memory_embeddings').insert({ user_id: user.id, content: memoryContent, embedding });
                }
              }

              await logPulseSignal(user.id, 'chat_interaction', {
                messageLength: message.length,
                responseLength: fullResponse.length,
                intent: functionCall?.name || 'general',
              });
            } catch (err) {
              logger.warn('Chat persistence or memory failed', err);
            }
          });
        }

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

function buildOrchestratorPrompt(ctx: any, _userId: string): string {
  const daysToExam = ctx.profile.examDate
    ? Math.ceil((new Date(ctx.profile.examDate).getTime() - Date.now()) / 86400000)
    : null;

  return `You are Cognition — the AI core of Cognition OS. Think of yourself as the student's most brilliant senior who has read every note they've uploaded, remembers every mistake, and is available at 3am.

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
- "give me questions / test me / quiz me" → trigger_tutor_session
- "make a study guide / revision sheet / flashcards" → trigger_tutor_session
- "I gave a test / upload a test / check my mock" → run_autopsy
- "how am I doing / my stats / progress" → show_analytics
- "my knowledge map / ATLAS" → show_atlas
- "review flashcards / due cards" → show_flashcards
- "I'm overwhelmed / reduce my tasks / lighten load" → adjust_planner
- "make a study plan / schedule" → create_study_plan
- "hey / hi / casual chat" → respond directly, NO function call

PERSONALITY:
Direct, warm, specific. No filler. No "Great question!". No restating what they said.
For casual messages: 1-2 sentences max, reference one real data point.`;
}

function buildOrchestratorTools() {
  return [
    {
      type: "function",
      function: {
        name: 'trigger_tutor_session',
        description: 'Activates the MIND tutor engine for explanations, practice, or artifact generation.',
        parameters: {
          type: 'object',
          properties: {
            topic: { type: 'string', description: 'Specific concept or topic to cover' },
            subject: { type: 'string', description: 'Subject area (Physics, Chemistry, Math, etc.)' },
          },
          required: ['topic'],
        },
      }
    },
    {
      type: "function",
      function: {
        name: 'create_study_plan',
        description: 'Generates a personalised day-by-day study plan.',
        parameters: {
          type: 'object',
          properties: {
            target_date: { type: 'string', description: 'Exam or target date (YYYY-MM-DD)' },
          },
          required: ['target_date'],
        },
      }
    },
    {
      type: "function",
      function: {
        name: 'run_autopsy',
        description: 'Opens mock test autopsy upload.',
        parameters: { type: 'object', properties: {} },
      }
    },
    {
      type: "function",
      function: {
        name: 'show_flashcards',
        description: 'Opens spaced repetition flashcard review.',
        parameters: { type: 'object', properties: {} },
      }
    },
    {
      type: "function",
      function: {
        name: 'show_atlas',
        description: 'Opens the ATLAS knowledge graph.',
        parameters: { type: 'object', properties: {} },
      }
    },
    {
      type: "function",
      function: {
        name: 'show_analytics',
        description: 'Opens performance analytics dashboard.',
        parameters: { type: 'object', properties: {} },
      }
    },
    {
      type: "function",
      function: {
        name: 'adjust_planner',
        description: 'Reduces or lightens daily workload when student signals overwhelm or fatigue.',
        parameters: {
          type: 'object',
          properties: {
            action: { type: 'string', description: 'reduce_tasks | lighten_intensity | add_break' },
          },
          required: ['action'],
        },
      }
    }
  ];
}

function intentToFunctionName(intent: string): string {
  const map: Record<string, string> = {
    'TUTOR_SESSION': 'trigger_tutor_session',
    'PRACTICE': 'trigger_tutor_session',
    'CREATE_ARTIFACT': 'trigger_tutor_session',
    'AUTOPSY': 'run_autopsy',
    'ANALYTICS': 'show_analytics',
    'ATLAS': 'show_atlas',
    'FLASHCARDS': 'show_flashcards',
    'REPLAN': 'adjust_planner',
  };
  return map[intent] || 'trigger_tutor_session';
}
