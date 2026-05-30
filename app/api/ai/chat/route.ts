import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateJSON } from '@/lib/ai/provider-client';
import { z } from 'zod';
import { checkRateLimit, rateLimitResponse } from '@/lib/middleware/rateLimit';
import { routeStreamGeneration, routeVisionCall } from '@/lib/ai/router';
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
import { checkSemanticCache, setSemanticCache, isCacheable } from '@/lib/ai/responseCache';
import { trackDailyAIUsage } from '@/lib/services/ai-usage.service';
import {
  getOrCreateGlobalChatSession,
  loadRecentMessages,
  persistChatMessage,
  stripMetadataBlock,
} from '@/lib/services/chat-persistence';

const encoder = new TextEncoder();

export async function POST(req: NextRequest) {
  // ============================================================================
  // STAGE 1: REQUEST VALIDATION
  // ============================================================================
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { allowed, remaining, resetAt } = await checkRateLimit({
    identifier: user.id,
    bucket: 'chat',
    maxTokens: 30,
    windowSeconds: 60,
    failClosed: true,
  });
  if (!allowed) return rateLimitResponse(remaining, resetAt);

  const ChatPayloadSchema = z.object({
    message: z.string().optional(),
    history: z.array(z.any()).optional(),
    imageBase64: z.string().optional(),
    imageMimeType: z.string().optional(),
    documentBase64: z.string().optional(),
    documentMimeType: z.string().optional(),
    chatId: z.string().optional(),
    sessionTurnsCount: z.number().optional()
  });

  let body;
  try { 
    body = ChatPayloadSchema.parse(await req.json()); 
  } catch (err) { 
    return new Response('Invalid JSON or Payload structure', { status: 400 }); 
  }

  const { message, imageBase64, imageMimeType, sessionTurnsCount } = body;
  const sessionId = await getOrCreateGlobalChatSession(supabase, user.id);

  if (imageBase64) {
    const imgValidation = validateBase64Payload(imageBase64);
    if (!imgValidation.valid) return imgValidation.error!;
  }

  const persistedHistory = await loadRecentMessages(supabase, sessionId);
  const recentHistory = persistedHistory.slice(-50);

  const userMessageForPersistence = message || (imageBase64 ? '[Image question]' : '');
  if (!userMessageForPersistence.trim()) {
    return NextResponse.json({ error: 'Message or upload is required' }, { status: 400 });
  }

  const { checkIdempotency } = await import('@/lib/middleware/idempotency');
  const idempotencyKey = req.headers.get('Idempotency-Key');
  const { isDuplicate, error: idempError } = await checkIdempotency(user.id, 'chat', idempotencyKey);
  
  if (idempError) return NextResponse.json({ error: idempError }, { status: 400 });
  if (isDuplicate) return NextResponse.json({ error: 'Duplicate request' }, { status: 409 });

  await persistChatMessage(supabase, {
    sessionId,
    userId: user.id,
    role: 'user',
    content: userMessageForPersistence,
  });

  // ============================================================================
  // STAGE 2: CONTEXT HYDRATION & INTENT (PARALLEL)
  // ============================================================================
  const profilePromise = supabase.from('profiles').select('exam_type').eq('id', user.id).maybeSingle();
  const intentPromise = classifyMessageCombined(
    message || '',
    recentHistory.slice(-2).map((m: any) => m.content).join(' '),
    undefined // Don't block intent on profile fetch
  );

  const [profileResult, intentResult] = await Promise.all([
    Promise.race([profilePromise, new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 1500))]).catch(() => ({ data: null })),
    Promise.race([intentPromise, new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 1500))]).catch(() => ({ 
      intent: { intent: 'GENERAL_CHAT' }, emotion: 'neutral', confidence: 0.5 
    }))
  ]) as [any, any];

  const profilePreview = profileResult?.data;
  const { intent: detectedIntent, emotion } = intentResult;

  // ============================================================================
  // STAGE 3 & 4: MEMORY RETRIEVAL & STUDENT MODEL (PARALLEL)
  // ============================================================================
  const memoryPromise = (message && message.trim().length > 15)
    ? new ChatMemoryService().searchMemory(user.id, message, 2).catch((err) => {
        logger.error('CRITICAL: Semantic memory failed', err);
        return [] as string[];
      })
    : Promise.resolve([] as string[]);

  const mindContextPromise = getMINDContext(
    user.id, 
    message, 
    detectedIntent.topic || undefined, 
    detectedIntent.subject || undefined
  ).catch((err) => {
    logger.error('Failed to get MIND context', err);
    return null;
  });

  const [semanticMemories, mindContext] = await Promise.all([
    Promise.race([memoryPromise, new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 1000))]).catch(() => [] as string[]),
    Promise.race([mindContextPromise, new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 1000))]).catch(() => null)
  ]) as [string[], any];

  let systemPrompt = getMINDSystemPrompt(mindContext, semanticMemories, detectedIntent.intent);
  const orchestratorResult = orchestrateFromIntent(
    detectedIntent,
    !!(imageBase64 && imageMimeType),
    message || ''
  );
  await logDecision(orchestratorResult, user.id, message || '').catch(() => {});

  // ============================================================================
  // STAGE 5: AI ORCHESTRATION & STREAMING
  // ============================================================================
  if (
    imageBase64 &&
    imageMimeType &&
    !(orchestratorResult.intent === 'mock_autopsy' && orchestratorResult.needsFileProcessing)
  ) {
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

        await persistChatMessage(supabase, {
          sessionId,
          userId: user.id,
          role: 'assistant',
          content: answer,
          intent: detectedIntent.intent,
          emotionalState: emotion,
        });
        await trackDailyAIUsage({
          userId: user.id,
          kind: 'image',
          promptTokens: Math.ceil((message || '').length / 4),
          completionTokens: Math.ceil(answer.length / 4),
        });

        await EventDispatcher.publish({
          user_id: user.id,
          type: 'CHAT_MESSAGE_PROCESSED',
          data: {
            sessionId,
            message: message || '[Image question]',
            fullResponse: answer,
            emotion,
            history: recentHistory,
            sessionTurnsCount,
            mindContext,
            intent: detectedIntent
          },
          idempotency_key: crypto.randomUUID()
        });

        controller.close();
      }
    });
    return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }

  if (
    orchestratorResult.intent === 'mock_autopsy' &&
    orchestratorResult.needsFileProcessing &&
    (imageBase64 || body?.documentBase64)
  ) {
    const responseText = "I can see you've uploaded a test paper. Let me run a full autopsy on it — analyzing every question, classifying mistakes, and updating your knowledge map. Give me 30 seconds.\n\nHead to the Autopsy section to see the full breakdown once I'm done.";
    const autopsyPayload = {
      fileData: imageBase64
        ? { kind: 'inline', data: imageBase64, mimeType: imageMimeType }
        : { kind: 'inline', data: body?.documentBase64, mimeType: body?.documentMimeType },
      testName: `Chat Upload ${new Date().toLocaleDateString()}`,
      examType: mindContext?.profile?.examType || 'neet',
    };

    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(encoder.encode(responseText));

        await persistChatMessage(supabase, {
          sessionId,
          userId: user.id,
          role: 'assistant',
          content: responseText,
          intent: detectedIntent.intent,
          emotionalState: emotion,
          metadata: { action: 'run_autopsy' },
        });
        await trackDailyAIUsage({
          userId: user.id,
          kind: 'chat',
          promptTokens: Math.ceil((message || '').length / 4),
          completionTokens: Math.ceil(responseText.length / 4),
        });

        await EventDispatcher.publish({
          user_id: user.id,
          type: 'CHAT_MESSAGE_PROCESSED',
          data: {
            sessionId,
            message: message || '[Autopsy upload]',
            fullResponse: responseText,
            emotion,
            history: recentHistory,
            sessionTurnsCount,
            mindContext,
            intent: detectedIntent,
          },
          idempotency_key: crypto.randomUUID(),
        });

        const autopsyRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/autopsy/ingest`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: req.headers.get('cookie') || '' },
          body: JSON.stringify(autopsyPayload),
        });
        if (!autopsyRes.ok) {
          const errorText = await autopsyRes.text().catch(() => '');
          logger.error('Background autopsy from chat failed', undefined, { status: autopsyRes.status, errorText });
        }

        controller.close();
      }
    });

    return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }

  const intent = detectedIntent;

  if (
    mindContext?.emotionalState === 'overwhelmed' &&
    ['TUTOR_SESSION', 'PRACTICE'].includes(orchestratorResult.intent)
  ) {
    const recentVictory = mindContext.weakConcepts.find((c: any) =>
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

        await persistChatMessage(supabase, {
          sessionId,
          userId: user.id,
          role: 'assistant',
          content: groundingMessage,
          intent: intent.intent,
          emotionalState: emotion,
        });
        await trackDailyAIUsage({
          userId: user.id,
          kind: 'chat',
          promptTokens: Math.ceil((message || '').length / 4),
          completionTokens: Math.ceil(groundingMessage.length / 4),
        });

        await EventDispatcher.publish({
          user_id: user.id,
          type: 'CHAT_MESSAGE_PROCESSED',
          data: {
            sessionId, message, fullResponse: groundingMessage, emotion,
            history: recentHistory, sessionTurnsCount, mindContext, intent
          },
          idempotency_key: crypto.randomUUID()
        });

        controller.close();
      }
    });
    return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' } });
  }

  const stream = new ReadableStream({
    async start(controller) {
      let fullResponse = '';
      let metadataPayload: any = null;

      try {
        if (['AUTOPSY', 'ANALYTICS', 'ATLAS', 'FLASHCARDS'].includes(intent.intent)) {
          const routeMessages: Record<string, string> = {
            AUTOPSY: "Opening **AUTOPSY** — upload your mock test PDF or photo. I'll diagnose every wrong answer by root cause and show you your recoverable score.",
            FLASHCARDS: `You have **${mindContext?.overdueCards || 0}** cards due today. Opening your revision queue now.`,
            ATLAS: `Your knowledge map is at **${mindContext?.masteryStats?.masteryPercent || 0}%** mastery. Opening ATLAS now.`,
            ANALYTICS: `Opening your performance dashboard. You are currently at **${mindContext?.masteryStats?.masteryPercent || 0}%** overall mastery with **${mindContext?.overdueCards || 0}** cards due.`,
          };
          const msg = routeMessages[intent.intent] || 'Opening that for you now...';
          controller.enqueue(encoder.encode(msg));
          fullResponse = msg;
          metadataPayload = { action: intentToAction(intent.intent) };

        } else if (intent.intent === 'REPLAN') {
          // Replan functionality
          const today = new Date().toISOString().split('T')[0];
          const action = intent.action || 'reduce_tasks';
          const { data: todayTasks } = await supabase.from('study_tasks').select('id, title, estimated_minutes, priority')
            .eq('user_id', user.id).eq('scheduled_date', today).eq('is_completed', false).order('priority', { ascending: false });

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
              await supabase.from('session_cards').delete().eq('user_id', user.id).eq('date', today);
            } else if (action === 'lighten_intensity') {
              let saved = 0;
              for (const task of todayTasks) {
                if ((task.estimated_minutes || 0) > 25) {
                  saved += task.estimated_minutes - 25;
                  await supabase.from('study_tasks').update({ estimated_minutes: 25 }).eq('id', task.id).eq('user_id', user.id);
                }
              }
              reply = `Done. All sessions capped at 25 minutes. ${saved} minutes saved. Short focused blocks are easier to start.`;
              await supabase.from('session_cards').delete().eq('user_id', user.id).eq('date', today);
            } else {
              await supabase.from('study_tasks').insert({
                user_id: user.id, title: 'Recovery Break', type: 'break', scheduled_date: today,
                estimated_minutes: 15, priority: 'low', is_completed: false,
              });
              reply = "Added a 15-minute recovery break. Step fully away from your desk — no studying.";
              await supabase.from('session_cards').delete().eq('user_id', user.id).eq('date', today);
            }
            controller.enqueue(encoder.encode(reply));
            fullResponse = reply;
            metadataPayload = { action: 'planner_adjusted', tasksModified: true, sessionCardInvalidated: true };
          }
        } else if (intent.intent === 'CREATE_ARTIFACT' || orchestratorResult.intent === 'planning') {
          const artifactSystemPrompt = `${systemPrompt}\n\nYou are in ARTIFACT CREATION mode. The student has asked you to create a study plan, planner, revision sheet, or similar artifact.\n\nRules:\n- If they mention an upcoming test date, build a day-by-day study plan from today until that date.\n- Cover all weak areas from their ATLAS profile first, then fill remaining days with stronger subjects.\n- Format the plan clearly with days, topics, and time estimates.\n- If the user simply asks to add a specific topic to their microtargets, dashboard, or planner, output a short 1-day plan with just that task.\n- If they say "full syllabus", cover all three subjects: Physics, Chemistry, Biology.\n- Be specific and actionable. Not generic.\n- End with one motivating line about what hitting this plan will do for their score.\n- IMPORTANT: Do NOT wrap the <artifact> tags in markdown code blocks (like \`\`\`xml). Output the raw <artifact> tags directly.`;
          const conversationMessages = buildConversationMessages(recentHistory, message || '');
          
          for await (const chunk of routeStreamGeneration(artifactSystemPrompt, conversationMessages, 0.6)) {
            controller.enqueue(encoder.encode(chunk));
            fullResponse += chunk;
          }

          controller.enqueue(encoder.encode('\n\n*Scheduling microtargets to your dashboard...*'));
          fullResponse += '\n\n*Scheduling microtargets to your dashboard...*';

          try {
            const todayStr = new Date().toISOString().split('T')[0];
            const extractPrompt = `You are a structured operational planner for Cognition OS.\nExtract a list of specific microtarget study tasks from this study plan to schedule in the student's database.\nIf a task does not have a specific date mentioned, schedule it for today (${todayStr}).\n\nStudy Plan Text:\n${fullResponse}\n\nReturn ONLY valid JSON matching this schema:\n{\n  "tasks": [\n    {\n      "title": "Short title of the task (e.g. Study Electrostatics, Revise Thermodynamics)",\n      "subject": "Physics|Chemistry|Biology|Mathematics",\n      "chapter": "Chapter name",\n      "estimated_minutes": 45,\n      "scheduled_date": "YYYY-MM-DD"\n    }\n  ]\n}`;
            const taskListSchema = z.object({
              tasks: z.array(z.object({
                title: z.string(), subject: z.string().optional().default('General'),
                chapter: z.string().optional().default(''), estimated_minutes: z.number().optional().default(45),
                scheduled_date: z.string().optional().default(todayStr)
              }))
            });

            const planData = await generateJSON<any>('flash', 'Expert task extractor. Output JSON only.', extractPrompt, taskListSchema).catch(() => null);

            if (planData && planData.tasks && planData.tasks.length > 0) {
              const tasksToInsert = planData.tasks.map((t: any) => ({
                user_id: user.id, title: t.title, type: 'study', subject: t.subject || 'General',
                chapter: t.chapter || '', estimated_minutes: t.estimated_minutes || 45,
                scheduled_date: t.scheduled_date || todayStr, is_completed: false,
                notes: 'Auto-extracted from chat study planner.'
              }));
              const datesToUpdate = Array.from(new Set(tasksToInsert.map((t: any) => t.scheduled_date)));
              if (datesToUpdate.length > 0) {
                 await supabase.from('study_tasks').delete().eq('user_id', user.id).eq('is_completed', false).in('scheduled_date', datesToUpdate);
              }
              await supabase.from('study_tasks').insert(tasksToInsert);
              const datesToInvalidate = Array.from(new Set([todayStr, ...datesToUpdate]));
              await supabase.from('session_cards').delete().eq('user_id', user.id).in('date', datesToInvalidate);
              metadataPayload = { action: 'planner_adjusted', tasksModified: true, sessionCardInvalidated: true };
            }
          } catch (err) { logger.warn('Failed to extract and insert study tasks from planner', err); }

        } else if (['TUTOR_SESSION', 'PRACTICE'].includes(intent.intent)) {
          const topic = intent.topic || 'General';
          const subject = intent.subject || mindContext?.weakConcepts?.[0]?.subject || 'General';
          const conceptId = await resolveConceptByName(user.id, subject, topic);
          if (!conceptId) {
            logger.warn('CONCEPT_RESOLUTION_FAILURE', { userId: user.id, subject, chapter: topic, reason: 'No matching concept found for tutoring session' });
          }
          const { data: mistakes } = await supabase.from('mistakes').select('category, ai_analysis').eq('user_id', user.id).ilike('chapter', `%${topic}%`).limit(5);

          let pastSessionCtx = '';
          let oldMasteryScore: number | null = null;
          if (conceptId) {
            const { data: conceptRec } = await supabase.from('concepts').select('mastery').eq('id', conceptId).single();
            if (conceptRec?.mastery) {
              oldMasteryScore = MASTERY_WEIGHTS[conceptRec.mastery] ?? null;
            }
            const { data: pastSessions } = await supabase.from('tutor_sessions').select('summary, started_at')
              .eq('user_id', user.id).eq('concept_id', conceptId).not('summary', 'is', null).order('started_at', { ascending: false }).limit(3);
            if (pastSessions?.length) {
              pastSessionCtx = '\n\nPAST SESSIONS ON THIS TOPIC:\n' + pastSessions.map((s: any) => `- [${new Date(s.started_at).toLocaleDateString()}] ${s.summary}`).join('\n');
            }
          }

          const tutorSystemPrompt = `${systemPrompt}\n\nACTIVE TUTOR SESSION:\nTopic: ${subject} > ${topic}\nPast Mistakes Here: ${mistakes?.map((m: any) => m.ai_analysis).join('; ') || 'None'}${pastSessionCtx}\n\nYou are now in active teaching mode for this topic. Apply RULE 3 (Learning Mode) — Socratic method, minimum 6-10 exchanges.`;
          const conversationMessages = buildConversationMessages(recentHistory, message || '');
          const hasUserSpecificContext = (mistakes && mistakes.length > 0) || (pastSessionCtx && pastSessionCtx.length > 0) || (oldMasteryScore !== null);
          const canCache = isCacheable({ intent: intent.intent, hasUserContext: hasUserSpecificContext });
          const cached = canCache && message ? await checkSemanticCache(message, user.id) : null;

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

          const isSessionComplete = sessionTurnsCount ? (sessionTurnsCount >= 6) : (recentHistory.length >= 10);
          if (isSessionComplete && recentHistory.length > 0) {
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

        if (metadataPayload) {
          controller.enqueue(encoder.encode(`\n\n===METADATA===\n${JSON.stringify(metadataPayload)}`));
        }

        // ============================================================================
        // STAGE 6 & 7: ASYNC SIDE EFFECTS (QUEUED)
        // ============================================================================
        if (message) {
          const persistedResponse = stripMetadataBlock(fullResponse);
          await persistChatMessage(supabase, {
            sessionId,
            userId: user.id,
            role: 'assistant',
            content: persistedResponse,
            intent: intent.intent,
            emotionalState: emotion,
            metadata: metadataPayload ?? {},
          });
          await trackDailyAIUsage({
            userId: user.id,
            kind: 'chat',
            promptTokens: Math.ceil((message || '').length / 4),
            completionTokens: Math.ceil(persistedResponse.length / 4),
          });

          await EventDispatcher.publish({
            user_id: user.id,
            type: 'CHAT_MESSAGE_PROCESSED',
            data: {
              sessionId,
              message,
              fullResponse,
              emotion,
              history: recentHistory,
              sessionTurnsCount,
              mindContext,
              intent
            },
            idempotency_key: crypto.randomUUID()
          }).catch(err => logger.error('Failed to enqueue CHAT_MESSAGE_PROCESSED event', err));
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
