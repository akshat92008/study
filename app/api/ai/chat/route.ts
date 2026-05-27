// app/api/ai/chat/route.ts
import { NextRequest } from 'next/server';
import { after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateJSON } from '@/lib/ai/gemini';
import { routeStreamGeneration } from '@/lib/ai/router';
import { getMINDContext } from '@/lib/engines/mind-engine';
import { getMINDSystemPrompt } from '@/lib/ai/prompts/mind-prompt';
import { updateConceptState } from '@/lib/engines/cognition-graph';
import { createSingleCard } from '@/lib/engines/revision-engine';
import { logger } from '@/lib/utils/logger';
import { resolveConceptByName } from '@/lib/engines/concept-resolver';
import { LearningStateEngine } from '@/lib/engines/learning-state-engine';
import { EventDispatcher } from '@/lib/events/orchestrator';
import { generateSessionClosingMessage } from '@/lib/engines/session-closing';
import { MASTERY_WEIGHTS } from '@/lib/engines/cognition-graph';
import { syncStudentModel } from '@/lib/engines/inference-engine';
import { ChatMemoryService } from '../../../../services/chat-memory.service';
import { detectChatIntent, buildConversationMessages } from '@/lib/ai/chat-intent';

const encoder = new TextEncoder();

import { routeVisionCall } from '@/lib/ai/router';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  let body: any;
  try { body = await req.json(); } catch { return new Response('Invalid JSON', { status: 400 }); }

  const { message, history, imageBase64, imageMimeType, chatId } = body;
  const sessionId = chatId || crypto.randomUUID();

  const [mindContext, semanticMemories] = await Promise.all([
    getMINDContext(user.id, message),
    message
      ? new ChatMemoryService().searchMemory(user.id, message, 3).catch((err) => {
          logger.error('CRITICAL: Semantic memory failed. match_chat_memory RPC may be missing.', err);
          return [] as string[];
        })
      : Promise.resolve([] as string[]),
  ]);

  // fallbackConceptId removed — was incorrectly updating ATLAS on every message.
  // Concept state updates only happen inside TUTOR_SESSION branch below.
  const systemPrompt = getMINDSystemPrompt(mindContext, semanticMemories);

  if (imageBase64 && imageMimeType) {
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const answer = await routeVisionCall(systemPrompt, imageBase64, imageMimeType, message || 'Solve this question completely.');
          controller.enqueue(encoder.encode(answer));
        } catch {
          controller.enqueue(encoder.encode('I had trouble reading that image. Try a clearer photo, or type the question out.'));
        }
        controller.close();
      }
    });
    return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }

  const intent = await detectChatIntent(
    message || '',
    (history || []).slice(-6),
    mindContext.profile.examType
  );

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
            ANALYTICS: 'Opening your performance dashboard.',
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
            } else if (action === 'lighten_intensity') {
              let saved = 0;
              for (const task of todayTasks) {
                if ((task.estimated_minutes || 0) > 25) {
                  saved += task.estimated_minutes - 25;
                  await supabase.from('study_tasks').update({ estimated_minutes: 25 }).eq('id', task.id).eq('user_id', user.id);
                }
              }
              reply = `Done. All sessions capped at 25 minutes. ${saved} minutes saved. Short focused blocks are easier to start.`;
            } else {
              await supabase.from('study_tasks').insert({
                user_id: user.id, title: 'Recovery Break',
                type: 'break', scheduled_date: today,
                estimated_minutes: 15, priority: 'low', is_completed: false,
              });
              reply = "Added a 15-minute recovery break. Step fully away from your desk — no studying.";
            }
            controller.enqueue(encoder.encode(reply));
            fullResponse = reply;
          }
          metadataPayload = { action: 'planner_adjusted', tasksModified: true };

        } else if (intent.intent === 'CREATE_ARTIFACT') {
          const topic = intent.topic || null;
          const subject = intent.subject || null;
          
          // Build a contextual system prompt for artifact generation
          const artifactSystemPrompt = `${systemPrompt}

You are in ARTIFACT CREATION mode. The student has asked you to create a study plan, planner, revision sheet, or similar artifact.

Rules:
- If they mention an upcoming test date, build a day-by-day study plan from today until that date.
- Cover all weak areas from their ATLAS profile first, then fill remaining days with stronger subjects.
- Format the plan clearly with days, topics, and time estimates.
- If they say "full syllabus", cover all three subjects: Physics, Chemistry, Biology.
- Be specific and actionable. Not generic.
- End with one motivating line about what hitting this plan will do for their score.`;

          const conversationMessages = buildConversationMessages(history || [], message || '');
          for await (const chunk of routeStreamGeneration(artifactSystemPrompt, conversationMessages, 0.6)) {
            controller.enqueue(encoder.encode(chunk));
            fullResponse += chunk;
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

          const conversationMessages = buildConversationMessages(history || [], message || '');
          for await (const chunk of routeStreamGeneration(tutorSystemPrompt, conversationMessages, 0.75)) {
            controller.enqueue(encoder.encode(chunk));
            fullResponse += chunk;
          }

          let analysis = { understood: false, gapFound: null as string | null, gapAnswer: null as string | null, summary: '' };
          let cardsCreated = 0;
          let newMasteryScore: number | null = null;

          if (history && history.length > 0) {
            try {
              const historySnippet = (history || []).slice(-6).map((m: any) => `${m.role === 'user' ? 'Student' : 'Tutor'}: ${m.content.slice(0, 200)}`).join('\n');
              const isPractice = intent.intent === 'PRACTICE';
              const analysisPrompt = isPractice
                ? `Analyze this practice interaction.\n${historySnippet}\nStudent Answer: ${message}\nAI Feedback: ${fullResponse.slice(0, 800)}\n\nDid the student answer correctly? Respond ONLY as JSON:\n{"summary":"1 sentence","understood":true,"gapFound":"flashcard question or null","gapAnswer":"flashcard answer or null"}`
                : `Analyze this tutor exchange.\n${historySnippet}\nStudent: ${message}\nTutor: ${fullResponse.slice(0, 800)}\n\nRespond ONLY as JSON:\n{"summary":"1 sentence","understood":true,"gapFound":"flashcard question or null","gapAnswer":"flashcard answer or null"}`;
              const raw = await generateJSON<any>('flash', 'Expert analyzer. Return JSON only.', analysisPrompt);
              if (raw && typeof raw.understood === 'boolean') {
                analysis = { understood: raw.understood, gapFound: typeof raw.gapFound === 'string' && raw.gapFound.length > 5 ? raw.gapFound : null, gapAnswer: typeof raw.gapAnswer === 'string' && raw.gapAnswer.length > 5 ? raw.gapAnswer : null, summary: raw.summary || '' };
              }
            } catch (err) { logger.warn('Session analysis failed', err); }

            if (!analysis.understood && analysis.gapFound && analysis.gapAnswer) {
              try {
                await createSingleCard(user.id, conceptId || null, analysis.gapFound, analysis.gapAnswer, subject, topic);
                cardsCreated = 1;
              } catch (err) { logger.warn('Gap card creation failed', err); }
            }

            const snap = { ...analysis };
            
            // Compute new mastery after updating concept state
            if (conceptId) {
              const estimatedTimeSeconds = Math.max(60, (history?.length || 0) * 30);
              await updateConceptState(conceptId, snap.understood, estimatedTimeSeconds);
              
              // Fetch updated mastery
              const { data: updatedConcept } = await supabase.from('concepts').select('mastery').eq('id', conceptId).single();
              if (updatedConcept?.mastery) {
                newMasteryScore = MASTERY_WEIGHTS[updatedConcept.mastery] ?? null;
              }
              
              // Insert session record
              if (intent.intent !== 'PRACTICE') {
                await supabase.from('tutor_sessions').insert({
                  user_id: user.id, concept_id: conceptId, summary: snap.summary,
                  messages: [...(history || []), { role: 'user', content: message }, { role: 'assistant', content: fullResponse }],
                });
              }
            }
            
            after(async () => {
              try {
                syncStudentModel(user.id).catch(() => {});
              } catch (err) { logger.error('Post-session synthesis failed', err); }
            });
          }

          const closing = await generateSessionClosingMessage({
            userId: user.id, conceptId: conceptId || null, subject, chapter: topic,
            gapFound: analysis.gapFound, gapAnswer: analysis.gapAnswer, understood: analysis.understood,
            turnsCount: history?.length || 0, 
            oldMastery: oldMasteryScore !== null ? oldMasteryScore / 100 : null, 
            newMastery: newMasteryScore !== null ? newMasteryScore / 100 : null, 
            cardsCreated,
            sessionId: `chat-${Date.now()}`,
          }).catch(() => null);

          if (closing) {
            metadataPayload = { action: 'session_closing_message', closingMessage: closing.text, closingType: closing.type, sessionComplete: true, cardsCreated };
          }
        } else {
          const conversationMessages = buildConversationMessages(history || [], message || '');
          for await (const chunk of routeStreamGeneration(systemPrompt, conversationMessages, 0.7)) {
            controller.enqueue(encoder.encode(chunk));
            fullResponse += chunk;
          }
        }

        if (message) {
          after(async () => {
            try {
              const { data: existingSession } = await supabase
                .from('chat_sessions').select('id').eq('id', sessionId).maybeSingle();

              let isNewSession = false;

              if (!existingSession) {
                await supabase.from('chat_sessions').insert({
                  id: sessionId, user_id: user.id,
                  session_type: 'global', title: 'Cognition OS Main Thread'
                });
                // Create a study session for focused tracking
                await supabase.from('study_sessions').insert({
                  user_id: user.id,
                  started_at: new Date().toISOString(),
                  focus_score: null,
                  duration_minutes: null
                });
                isNewSession = true;
              }

              // Remove metadata from response stored in database for cleaner history retrieval
              const strippedResponse = fullResponse.replace(/\n\n===METADATA===\n[\s\S]*/g, '').trim();

              await supabase.from('chat_messages').insert([
                { session_id: sessionId, user_id: user.id, role: 'user', content: message },
                // Artificial slice removed to prevent artifact tags being truncated.
                // A truncated artifact (missing </artifact>) breaks the parseArtifacts regex on page reload,
                // causing raw XML to show instead of the rendered card.
                { session_id: sessionId, user_id: user.id, role: 'assistant', content: strippedResponse },
              ]);

              if (isNewSession) {
                const { count } = await supabase.from('chat_sessions').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
                if (count && count <= 3) {
                  // Bug 4: explicitly trigger initial style fingerprinting for first 3 sessions
                  syncStudentModel(user.id, true).catch(() => {});
                }
              }

              // Embedding stored via ChatMemoryService (duplicate removed)

              // Semantic memory storage (store only user message to avoid duplicate embeddings)
              const memSvc = new ChatMemoryService();
              await memSvc.storeMessageInMemory(user.id, message).catch(() => {});

              // Only fire if we have a real concept context — not for generic messages
              const sessionSubject = (mindContext as any)?.currentTopic?.subject || mindContext?.weakConcepts?.[0]?.subject;
              const sessionChapter = (mindContext as any)?.currentTopic?.chapter || mindContext?.weakConcepts?.[0]?.chapter;

              if (sessionSubject && sessionChapter && sessionSubject !== 'General') {
                const messageCount = history?.length || 1;
                const estimatedMinutes = Math.max(5, Math.round(messageCount * 1.5));

                try {
                  await EventDispatcher.publish({
                    user_id: user.id,
                    type: 'MIND_TUTOR_COMPLETED',
                    data: {
                      conceptId: null,
                      subject: sessionSubject,
                      chapter: sessionChapter,
                      understandingGained: true,
                      durationMinutes: estimatedMinutes,
                      messageCount,
                      sessionType: (mindContext as any)?.sessionType || 'chat',
                    },
                    metadata: { source: 'chat' },
                    // Use minute-level granularity so rapid messages don't spam consumers
                    idempotency_key: `session:${user.id}:${sessionSubject}:${sessionChapter}:${new Date().toISOString().slice(0, 16)}`,
                  });
                } catch (err) {
                  logger.warn('STUDY_SESSION_COMPLETED event failed (non-fatal)', err);
                }
              }
            } catch (err) {
              logger.warn('Chat persistence failed', err);
            }
            // fallback concept state update removed
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
