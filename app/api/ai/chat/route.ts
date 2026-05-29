// app/api/ai/chat/route.ts
import { NextRequest } from 'next/server';
import { after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateJSON } from '@/lib/ai/gemini';
import { z } from 'zod';
import { checkRateLimit, rateLimitResponse } from '@/lib/middleware/rateLimit';
import { routeStreamGeneration } from '@/lib/ai/router';
import { getMINDContext } from '@/lib/engines/mind-engine';
import { getMINDSystemPrompt } from '@/lib/ai/prompts/mind-prompt';
import { updateConceptState } from '@/lib/engines/cognition-graph';
import { createSingleCard } from '@/lib/engines/revision-engine';
import { logger } from '@/lib/utils/logger';
import { orchestrateFromIntent } from '@/lib/engines/orchestrator';
import { logDecision } from '@/lib/utils/orchestratorLogger';
import { resolveConceptByName } from '@/lib/engines/concept-resolver';
import { LearningStateEngine } from '@/lib/engines/learning-state-engine';
import { EventDispatcher } from '@/lib/events/orchestrator';
import { generateSessionClosingMessage } from '@/lib/engines/session-closing';
import { MASTERY_WEIGHTS } from '@/lib/engines/cognition-graph';
import { syncStudentModel } from '@/lib/engines/inference-engine';
import { ChatMemoryService } from '@/lib/services/chatMemoryService';
import { buildConversationMessages } from '@/lib/ai/chat-intent';
import { classifyMessageCombined } from '@/lib/ai/chat-intent-with-emotion';
import { validateBase64Payload } from '@/lib/middleware/validateUpload';
import { processChatSideEffects } from '@/lib/ai/chat-side-effects';
import { checkSemanticCache, setSemanticCache, isCacheable } from '@/lib/ai/responseCache';

const encoder = new TextEncoder();

import { routeVisionCall } from '@/lib/ai/router';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  // Rate limit: 30 chat messages per minute per user
  const { allowed, remaining, resetAt } = await checkRateLimit({
    identifier: user.id,
    bucket: 'chat',
    maxTokens: 30,
    windowSeconds: 60,
  });
  if (!allowed) return rateLimitResponse(remaining, resetAt);

  let body: any;
  try { body = await req.json(); } catch { return new Response('Invalid JSON', { status: 400 }); }

  const { message, history, imageBase64, imageMimeType, chatId, sessionTurnsCount } = body;
  const sessionId = chatId || crypto.randomUUID();

  if (imageBase64) {
    const imgValidation = validateBase64Payload(imageBase64);
    if (!imgValidation.valid) return imgValidation.error!;
  }

  const recentHistory = (history || []).slice(-6); // Hard budget on history length

  const { data: profilePreview } = await supabase.from('profiles').select('exam_type').eq('id', user.id).maybeSingle();

  const { intent: detectedIntent, emotion, confidence } = await classifyMessageCombined(
    message || '',
    recentHistory.slice(-2).map((m: any) => m.content).join(' '),
    profilePreview?.exam_type || undefined
  );

  const [mindContext, semanticMemories] = await Promise.all([
    getMINDContext(
      user.id, 
      message, 
      detectedIntent.topic || undefined, 
      detectedIntent.subject || undefined
    ),
    (message && message.trim().length > 15)
      ? new ChatMemoryService().searchMemory(user.id, message, 2).catch((err) => {
          logger.error('CRITICAL: Semantic memory failed. match_chat_memory RPC may be missing.', err);
          return [] as string[];
        })
      : Promise.resolve([] as string[]),
  ]);

  let systemPrompt = getMINDSystemPrompt(mindContext, semanticMemories, detectedIntent.intent);

  if (imageBase64 && imageMimeType) {
    const stream = new ReadableStream({
      async start(controller) {
        let answer = '';
        try {
          answer = await routeVisionCall(systemPrompt, imageBase64, imageMimeType, message || 'Solve this question completely.');
          controller.enqueue(encoder.encode(answer));
        } catch {
          answer = 'I had trouble reading that image. Try a clearer photo, or type the question out.';
          controller.enqueue(encoder.encode(answer));
        }

        try {
          const userContent = message || '[Image question]';
          const { data: existingSession } = await supabase
            .from('chat_sessions')
            .select('id')
            .eq('id', sessionId)
            .maybeSingle();

          if (!existingSession) {
            await supabase.from('chat_sessions').insert({
              id: sessionId,
              user_id: user.id,
              session_type: 'global',
              title: 'Cognition OS Main Thread',
            });
          }

          await supabase.from('chat_messages').insert([
            {
              session_id: sessionId,
              user_id: user.id,
              role: 'user',
              content: userContent,
              metadata: { attachmentType: 'image', imageMimeType },
            },
            {
              session_id: sessionId,
              user_id: user.id,
              role: 'assistant',
              content: answer,
            },
          ]);

          if (message) {
            await new ChatMemoryService().storeMessageInMemory(user.id, message).catch(() => {});
          }
        } catch (err) {
          logger.warn('Image chat persistence failed', err);
        }
        controller.close();
      }
    });
    return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }

  // Orchestrate using the already-classified intent — no second LLM call.
  const orchestratorResult = orchestrateFromIntent(
    detectedIntent,
    !!(imageBase64 && imageMimeType),
    message || ''
  );
  await logDecision(orchestratorResult, user.id, message || '');

// If orchestrator says this is a mock autopsy (file uploaded with test intent),
// hand off to the autopsy ingest endpoint internally instead of answering in chat.
if (
  orchestratorResult.intent === 'mock_autopsy' &&
  orchestratorResult.needsFileProcessing &&
  (imageBase64 || body?.documentBase64)
) {
  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(
        "I can see you've uploaded a test paper. Let me run a full autopsy on it — analyzing every question, classifying mistakes, and updating your knowledge map. Give me 30 seconds.\n\nHead to the Autopsy section to see the full breakdown once I'm done."
      ));
      controller.close();
    }
  });
  // Fire autopsy in background
  const autopsyPayload = {
    fileData: imageBase64
      ? { kind: 'inline', data: imageBase64, mimeType: imageMimeType }
      : { kind: 'inline', data: body?.documentBase64, mimeType: body?.documentMimeType },
    testName: `Chat Upload ${new Date().toLocaleDateString()}`,
    examType: mindContext.profile.examType,
  };
  fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/autopsy/ingest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: req.headers.get('cookie') || '',
    },
    body: JSON.stringify(autopsyPayload),
  }).catch(err => logger.warn('Background autopsy from chat failed', err));

  return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

// Intent from detected intent
const intent = detectedIntent;

// OVERWHELMED GATE — Hard structural enforcement.
// When emotional state is overwhelmed, override TUTOR_SESSION and PRACTICE intents
// regardless of what the student asked. The vision is explicit: "stop teaching new material immediately."
if (
  mindContext.emotionalState === 'overwhelmed' &&
  ['TUTOR_SESSION', 'PRACTICE'].includes(orchestratorResult.intent)
) {
  const recentVictory = mindContext.weakConcepts.find(c =>
    c.mastery === 'developing' || c.mastery === 'proficient'
  );
  const masteryPercent = mindContext.masteryStats.masteryPercent;
  const streakDays = mindContext.profile.streakDays;

  const groundingMessage = [
    `Before we go into ${intent.topic || 'that topic'} — I'm noticing you seem overwhelmed right now, and I'm not going to add more to the pile.`,
    ``,
    `Here's what's actually true right now: you're at ${masteryPercent}% mastery across your syllabus.`,
    streakDays > 1 ? `You've shown up ${streakDays} days in a row. That's not nothing.` : '',
    recentVictory ? `You're developing ${recentVictory.name} — that's real progress, not luck.` : '',
    ``,
    `Right now, pick one of these:`,
    ``,
    `**1. Take 10 minutes away from your screen.** Come back and we'll tackle one small thing together.`,
    ``,
    `**2. Tell me one specific thing that's making you feel stuck.** Not "everything" — one thing. I'll help you sort it.`,
    ``,
    `**3. Do 5 flashcard reviews only.** Short. Familiar. It'll remind your brain it still knows things.`,
    ``,
    `Which one works for right now?`,
  ].filter(Boolean).join('\n');

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(groundingMessage));

      if (message && sessionId) {
        try {
          await supabase.from('chat_messages').insert([
            { session_id: sessionId, user_id: user.id, role: 'user', content: message },
            { session_id: sessionId, user_id: user.id, role: 'assistant', content: groundingMessage },
          ]);
        } catch {}
      }

      controller.close();
    }
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' }
  });
}

  const stream = new ReadableStream({
    async start(controller) {
      let fullResponse = '';
      let metadataPayload: any = null;

      try {
        if (['AUTOPSY', 'ANALYTICS', 'ATLAS', 'FLASHCARDS'].includes(intent.intent)) {
          const routeMessages: Record<string, string> = {
            AUTOPSY: "Opening **AUTOPSY** — upload your mock test PDF or photo. I'll diagnose every wrong answer by root cause and show you your recoverable score.",
            FLASHCARDS: `You have **${mindContext.overdueCards}** cards due today. Opening your revision queue now.`,
            ATLAS: `Your knowledge map is at **${mindContext.masteryStats.masteryPercent}%** mastery. Opening ATLAS now.`,
            ANALYTICS: `Opening your performance dashboard. You are currently at **${mindContext.masteryStats.masteryPercent}%** overall mastery with **${mindContext.overdueCards}** cards due.`,
          };
          const msg = routeMessages[intent.intent] || 'Opening that for you now...';
          controller.enqueue(encoder.encode(msg));
          fullResponse = msg;
          metadataPayload = { action: intentToAction(intent.intent) };

        } else if (intent.intent === 'REPLAN') {
          const today = new Date().toISOString().split('T')[0];
          const action = intent.action || 'reduce_tasks';

          const { data: todayTasks } = await supabase
            .from('study_tasks')
            .select('id, title, estimated_minutes, priority')
            .eq('user_id', user.id)
            .eq('scheduled_date', today)
            .eq('is_completed', false)
            .order('priority', { ascending: false });

          if (!todayTasks || todayTasks.length === 0) {
            const reply = "You have no tasks left for today — nothing to adjust. Want me to build a lighter plan from scratch?";
            controller.enqueue(encoder.encode(reply));
            fullResponse = reply;
          } else {
            let reply = '';
            if (action === 'reduce_tasks') {
              const removeCount = Math.max(1, Math.floor(todayTasks.length * 0.3));
              const toRemove = todayTasks.slice(0, removeCount);
              await supabase.from('study_tasks').delete().in('id', toRemove.map((t: any) => t.id)).eq('user_id', user.id);
              const saved = toRemove.reduce((s: number, t: any) => s + (t.estimated_minutes || 0), 0);
              reply = `Done. Removed ${toRemove.length} task${toRemove.length > 1 ? 's' : ''} from today — ${saved} minutes freed. Focus on what remains.`;
              const todayForCache = new Date().toISOString().split('T')[0];
              await supabase
                .from('session_cards')
                .delete()
                .eq('user_id', user.id)
                .eq('date', todayForCache);
            } else if (action === 'lighten_intensity') {
              let saved = 0;
              for (const task of todayTasks) {
                if ((task.estimated_minutes || 0) > 25) {
                  saved += task.estimated_minutes - 25;
                  await supabase.from('study_tasks').update({ estimated_minutes: 25 }).eq('id', task.id).eq('user_id', user.id);
                }
              }
              reply = `Done. All sessions capped at 25 minutes. ${saved} minutes saved. Short focused blocks are easier to start.`;
              const todayForCache = new Date().toISOString().split('T')[0];
              await supabase
                .from('session_cards')
                .delete()
                .eq('user_id', user.id)
                .eq('date', todayForCache);
            } else {
              await supabase.from('study_tasks').insert({
                user_id: user.id, title: 'Recovery Break',
                type: 'break', scheduled_date: today,
                estimated_minutes: 15, priority: 'low', is_completed: false,
              });
              reply = "Added a 15-minute recovery break. Step fully away from your desk — no studying.";
              const todayForCache = new Date().toISOString().split('T')[0];
              await supabase
                .from('session_cards')
                .delete()
                .eq('user_id', user.id)
                .eq('date', todayForCache);
            }
            controller.enqueue(encoder.encode(reply));
            fullResponse = reply;
                    metadataPayload = { action: 'planner_adjusted', tasksModified: true, sessionCardInvalidated: true };
          }

        } else if (intent.intent === 'CREATE_ARTIFACT' || orchestratorResult.intent === 'planning') {
          const topic = intent.topic || null;
          const subject = intent.subject || null;
          
          // Build a contextual system prompt for artifact generation
          const artifactSystemPrompt = `${systemPrompt}

You are in ARTIFACT CREATION mode. The student has asked you to create a study plan, planner, revision sheet, or similar artifact.

Rules:
- If they mention an upcoming test date, build a day-by-day study plan from today until that date.
- Cover all weak areas from their ATLAS profile first, then fill remaining days with stronger subjects.
- Format the plan clearly with days, topics, and time estimates.
- If the user simply asks to add a specific topic to their microtargets, dashboard, or planner, output a short 1-day plan with just that task.
- If they say "full syllabus", cover all three subjects: Physics, Chemistry, Biology.
- Be specific and actionable. Not generic.
- End with one motivating line about what hitting this plan will do for their score.
- IMPORTANT: Do NOT wrap the <artifact> tags in markdown code blocks (like \`\`\`xml). Output the raw <artifact> tags directly.`;

          const conversationMessages = buildConversationMessages(recentHistory, message || '');
          for await (const chunk of routeStreamGeneration(artifactSystemPrompt, conversationMessages, 0.6)) {
            controller.enqueue(encoder.encode(chunk));
            fullResponse += chunk;
          }

          controller.enqueue(encoder.encode('\n\n*Scheduling microtargets to your dashboard...*'));
          fullResponse += '\n\n*Scheduling microtargets to your dashboard...*';

          try {
            const todayStr = new Date().toISOString().split('T')[0];
            const extractPrompt = `You are a structured operational planner for Cognition OS.
Extract a list of specific microtarget study tasks from this study plan to schedule in the student's database.
If a task does not have a specific date mentioned, schedule it for today (${todayStr}).

Study Plan Text:
${fullResponse}

Return ONLY valid JSON matching this schema:
{
  "tasks": [
    {
      "title": "Short title of the task (e.g. Study Electrostatics, Revise Thermodynamics)",
      "subject": "Physics|Chemistry|Biology|Mathematics",
      "chapter": "Chapter name",
      "estimated_minutes": 45,
      "scheduled_date": "YYYY-MM-DD"
    }
  ]
}`;
            
            const taskListSchema = z.object({
              tasks: z.array(z.object({
                title: z.string(),
                subject: z.string().optional().default('General'),
                chapter: z.string().optional().default(''),
                estimated_minutes: z.number().optional().default(45),
                scheduled_date: z.string().optional().default(todayStr)
              }))
            });

            const planData = await generateJSON<any>(
              'flash',
              'Expert task extractor. Output JSON only.',
              extractPrompt,
              taskListSchema
            ).catch(() => null);

            if (planData && planData.tasks && planData.tasks.length > 0) {
              const tasksToInsert = planData.tasks.map((t: any) => ({
                user_id: user.id,
                title: t.title,
                type: 'study',
                subject: t.subject || 'General',
                chapter: t.chapter || '',
                estimated_minutes: t.estimated_minutes || 45,
                scheduled_date: t.scheduled_date || todayStr,
                is_completed: false,
                notes: 'Auto-extracted from chat study planner.'
              }));
              
              const datesToUpdate = Array.from(new Set(tasksToInsert.map((t: any) => t.scheduled_date)));
              if (datesToUpdate.length > 0) {
                 await supabase
                   .from('study_tasks')
                   .delete()
                   .eq('user_id', user.id)
                   .eq('is_completed', false)
                   .in('scheduled_date', datesToUpdate);
              }

              await supabase.from('study_tasks').insert(tasksToInsert);
              logger.info(`Auto-inserted ${tasksToInsert.length} microtargets from study planner`, { userId: user.id });

              const datesToInvalidate = Array.from(new Set([
                todayStr,
                ...datesToUpdate
              ]));
              await supabase
                .from('session_cards')
                .delete()
                .eq('user_id', user.id)
                .in('date', datesToInvalidate);
                
              metadataPayload = { action: 'planner_adjusted', tasksModified: true, sessionCardInvalidated: true };
            }
          } catch (err) {
            logger.warn('Failed to extract and insert study tasks from planner', err);
          }

        } else if (['TUTOR_SESSION', 'PRACTICE'].includes(intent.intent)) {
          const topic = intent.topic || 'General';
          const subject = intent.subject || mindContext.weakConcepts[0]?.subject || 'General';
          const conceptId = await resolveConceptByName(user.id, subject, topic);
          if (!conceptId) {
            logger.warn('CONCEPT_RESOLUTION_FAILURE', { userId: user.id, subject, chapter: topic, reason: 'No matching concept found for tutoring session' });
          }
          const { data: mistakes } = await supabase.from('mistakes').select('category, ai_analysis').eq('user_id', user.id).ilike('chapter', `%${topic}%`).limit(5);

          let pastSessionCtx = '';
          let oldMasteryScore: number | null = null;
          if (conceptId) {
            // Fetch old mastery level for closing message
            const { data: conceptRec } = await supabase.from('concepts').select('mastery').eq('id', conceptId).single();
            if (conceptRec?.mastery) {
              oldMasteryScore = MASTERY_WEIGHTS[conceptRec.mastery] ?? null;
            }

            const { data: pastSessions } = await supabase
              .from('tutor_sessions')
              .select('summary, started_at')
              .eq('user_id', user.id)
              .eq('concept_id', conceptId)
              .not('summary', 'is', null)
              .order('started_at', { ascending: false })
              .limit(3);
            if (pastSessions?.length) {
              pastSessionCtx = '\n\nPAST SESSIONS ON THIS TOPIC:\n' + pastSessions.map((s: any) => `- [${new Date(s.started_at).toLocaleDateString()}] ${s.summary}`).join('\n');
            }
          }

          const tutorSystemPrompt = `${systemPrompt}\n\nACTIVE TUTOR SESSION:\nTopic: ${subject} > ${topic}\nPast Mistakes Here: ${mistakes?.map((m: any) => m.ai_analysis).join('; ') || 'None'}${pastSessionCtx}\n\nYou are now in active teaching mode for this topic. Apply RULE 3 (Learning Mode) — Socratic method, minimum 6-10 exchanges.`;

          const conversationMessages = buildConversationMessages(recentHistory, message || '');
          const canCache = isCacheable({ intent: intent.intent, hasUserContext: false });
          const cached = canCache && message ? await checkSemanticCache(message) : null;

          if (cached) {
            controller.enqueue(encoder.encode(cached));
            fullResponse = cached;
          } else {
            for await (const chunk of routeStreamGeneration(tutorSystemPrompt, conversationMessages, 0.75)) {
              controller.enqueue(encoder.encode(chunk));
              fullResponse += chunk;
            }
            if (canCache && message) {
              setSemanticCache(message, fullResponse).catch(err => logger.error('Cache save failed', err));
            }
          }

          let analysis = { understood: false, gapFound: null as string | null, gapAnswer: null as string | null, summary: '' };
          let cardsCreated = 0;
          let newMasteryScore: number | null = null;

          const isSessionComplete = sessionTurnsCount ? (sessionTurnsCount >= 6) : (history && history.length >= 10);

          if (isSessionComplete && history && history.length > 0) {
            // Asynchronous post-processing will be handled by the event bus.
            // We provide immediate closure to the user without blocking for multiple LLM calls.
            metadataPayload = { 
              action: 'session_closing_message', 
              closingMessage: "We've covered a lot today. I'm analyzing our session in the background and will update your knowledge map and flashcards shortly.", 
              closingType: 'async_analysis', 
              sessionComplete: true 
            };
          }
        } else {
          const conversationMessages = buildConversationMessages(recentHistory, message || '');
          for await (const chunk of routeStreamGeneration(systemPrompt, conversationMessages, 0.7)) {
            controller.enqueue(encoder.encode(chunk));
            fullResponse += chunk;
          }
        }

        if (message) {
          after(async () => {
            await processChatSideEffects({
              supabase,
              userId: user.id,
              sessionId,
              message,
              fullResponse,
              emotion,
              history: history || [],
              sessionTurnsCount,
              mindContext,
              intent
            });
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

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Accel-Buffering': 'no',
      'Cache-Control': 'no-cache',
    }
  });
}

function intentToAction(intent: string): string {
  const map: Record<string, string> = {
    AUTOPSY: 'run_autopsy',
    ANALYTICS: 'show_analytics',
    ATLAS: 'show_atlas',
    FLASHCARDS: 'show_flashcards',
  };
  return map[intent] || 'show_analytics';
}
