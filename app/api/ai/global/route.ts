import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { streamText, generateJSON } from '@/lib/ai/gemini';
import { getMINDContext } from '@/lib/engines/mind-engine';
import { getMINDSystemPrompt, buildMINDUserPrompt } from '@/lib/ai/prompts/mind-prompt';
import { updateConceptState } from '@/lib/engines/cognition-graph';
import { createSingleCard } from '@/lib/engines/revision-engine';
import { logger } from '@/lib/utils/logger';
import { CommandPlanner } from '@/lib/engines/command-engine';
import { LearningStateEngine } from '@/lib/engines/learning-state-engine';
import { logPulseSignal } from '@/lib/engines/pulse-engine';
import { resolveConceptByName } from '@/lib/engines/concept-resolver';
import { z } from 'zod';

// Define the Intent Detection Schema
const IntentDetectionSchema = z.object({
  intent: z.enum([
    'CREATE_GOAL',
    'REPLAN',
    'MARK_COMPLETE',
    'UPDATE_MASTERY',
    'SCHEDULE_REVISION',
    'DETECT_BURNOUT',
    'TUTOR_SESSION',
    'GENERAL_CHAT'
  ]),
  arguments: z.object({
    title: z.string().optional(),
    deadline: z.string().optional(),
    currentLevel: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
    timeAvailable: z.number().optional(),
    preferredLearningStyle: z.enum(['visual', 'auditory', 'read_write', 'kinesthetic']).optional(),
    date: z.string().optional(),
    taskId: z.string().optional(),
    subject: z.string().optional(),
    chapter: z.string().optional(),
    correct: z.boolean().optional(),
    front: z.string().optional(),
    back: z.string().optional(),
    emotionalState: z.enum(['focused', 'neutral', 'frustrated', 'overwhelmed']).optional()
  }).optional()
});

// Helper to stream a static message chunk by chunk to simulate AI response
function streamTextResponse(text: string): ReadableStream {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      const words = text.split(' ');
      for (const word of words) {
        controller.enqueue(encoder.encode(word + ' '));
        await new Promise((resolve) => setTimeout(resolve, 30));
      }
      controller.close();
    }
  });
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response('Unauthorized', { status: 401 });

    const { message, history, currentPath } = await req.json();

    // 1. Format history context for classifier
    const recentHistoryText = (history || [])
      .slice(-6)
      .map((m: any) => `${m.role === 'user' ? 'Student' : 'COMMAND'}: ${m.content}`)
      .join('\n');

    // 2. Classify Student Intent using Gemini Flash
    const classificationPrompt = `
      You are COMMAND, the central operating system kernel of Cognition OS.
      Your job is to identify if the student's message represents a directive to execute a system command (Operating System action) or if it's general chat/tutoring.
      
      Classify the intent into one of these types:
      - 'CREATE_GOAL': Student wants to create a new learning goal or roadmap. E.g., "create a goal to learn physics", "generate roadmap for CFA Level 1".
      - 'REPLAN': Student wants to replan or reschedule their day/tasks. E.g., "replan my schedule", "reschedule today's tasks".
      - 'MARK_COMPLETE': Student wants to mark a task as completed. E.g., "finish the first task", "mark Laws of Motion practice as done".
      - 'UPDATE_MASTERY': Student wants to update their mastery or report status of a topic. E.g., "mark Electrostatics as master", "I am weak in centripetal force", "I understand Gauss Law".
      - 'SCHEDULE_REVISION': Student wants to schedule a revision or add a flashcard. E.g., "schedule revision for Mitochondria", "create flashcard for dot product".
      - 'DETECT_BURNOUT': Student reports high stress, burnout, fatigue, or need for a break. E.g., "I am overwhelmed", "I feel stressed", "give me a break".
      - 'TUTOR_SESSION': Student is asking an academic question or wants tutoring, practice, quiz, or Socratic guidance on a topic.
      - 'GENERAL_CHAT': General greetings, friendly chit-chat or generic assistant tasks.
      
      Extract arguments if applicable:
      - CREATE_GOAL: 'title' (extracted title of goal), 'deadline' (YYYY-MM-DD, default 6 months from now if unspecified), 'currentLevel' ('beginner' | 'intermediate' | 'advanced', default 'intermediate'), 'timeAvailable' (number, daily hours, default 4), 'preferredLearningStyle' ('visual' | 'auditory' | 'read_write' | 'kinesthetic', default 'visual').
      - REPLAN: 'date' (YYYY-MM-DD, defaults to today's date).
      - MARK_COMPLETE: 'taskId' (string). If unspecified but they mention a title, extract it in 'title'.
      - UPDATE_MASTERY: 'subject' (e.g. 'Physics'), 'chapter' (concept/chapter name, e.g. 'Coulomb\'s Law' or 'Mitochondria'), 'correct' (boolean, true if they master/understand it, false if they struggle/are weak).
      - SCHEDULE_REVISION: 'subject' (optional), 'chapter' (optional), 'front' (front text), 'back' (back text).
      - DETECT_BURNOUT: 'emotionalState' ('focused' | 'neutral' | 'frustrated' | 'overwhelmed').
      
      Message history:
      ${recentHistoryText}
      
      Current message:
      "${message}"
    `;

    const detection = await generateJSON<z.infer<typeof IntentDetectionSchema>>(
      'flash',
      'You are the intent classification module of the Cognition OS kernel.',
      classificationPrompt,
      IntentDetectionSchema
    );

    const intent = detection?.intent || 'GENERAL_CHAT';
    const args = detection?.arguments || {};

    logger.info('COMMAND Intent Classifier Result', { intent, args });

    // 3. Execute System Command Layer
    if (intent === 'CREATE_GOAL') {
      const title = args.title || 'NEET/Academic Mastery';
      // Set deadline 6 months from now if invalid/unspecified
      let deadline = args.deadline;
      if (!deadline || isNaN(Date.parse(deadline))) {
        const d = new Date();
        d.setMonth(d.getMonth() + 6);
        deadline = d.toISOString().split('T')[0];
      }
      const currentLevel = args.currentLevel || 'intermediate';
      const timeAvailable = args.timeAvailable || 4;
      const preferredLearningStyle = args.preferredLearningStyle || 'visual';

      const planner = new CommandPlanner();
      const result = await planner.initializeGoalRoadmap(user.id, {
        title,
        deadline,
        currentLevel,
        timeAvailable,
        preferredLearningStyle,
        uploadedMaterialIds: []
      });

      // Log event
      await LearningStateEngine.ingestEvent({
        userId: user.id,
        type: 'SESSION_COMPLETED',
        data: { title, goalId: result.goalId, isGoalInit: true }
      });

      const responseText = `[System Command: CREATE_GOAL]\n\nInitiating goal: **${title}**...\n- Generating structured roadmap milestones...\n- Seeding concept graph nodes in ATLAS...\n\nActive learning roadmap generated successfully! Your sidebar and learning goals have been synchronized. Ready for launch.`;
      return new Response(streamTextResponse(responseText), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }

    if (intent === 'REPLAN') {
      const todayStr = new Date().toISOString().split('T')[0];
      const date = args.date || todayStr;

      await LearningStateEngine.replanForUser(user.id, date);

      const responseText = `[System Command: REPLAN]\n\nRecalculating knowledge mastery priority scores...\n- Sorting active retention curves...\n- Packing study blocks for **${date}**...\n\nYour study plan has been dynamically replanned and optimized. All dashboard widgets are updated.`;
      return new Response(streamTextResponse(responseText), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }

    if (intent === 'MARK_COMPLETE') {
      const todayStr = new Date().toISOString().split('T')[0];
      const startOfDay = new Date(new Date(todayStr).setHours(0,0,0,0)).toISOString();
      
      // Load user's incomplete tasks for today
      const { data: tasks } = await supabase
        .from('study_tasks')
        .select('*')
        .eq('user_id', user.id)
        .eq('scheduled_date', startOfDay)
        .eq('is_completed', false);

      let targetTask = null;
      if (tasks && tasks.length > 0) {
        if (args.title) {
          targetTask = tasks.find(t => t.title.toLowerCase().includes(args.title!.toLowerCase()));
        }
        if (!targetTask && args.taskId) {
          targetTask = tasks.find(t => t.id === args.taskId);
        }
        if (!targetTask) {
          targetTask = tasks[0]; // fallback
        }
      }

      if (!targetTask) {
        const responseText = `[System Command: MARK_COMPLETE]\n\nLooking for incomplete tasks for today...\n- No active incomplete tasks found on your schedule for today. If you need to plan new tasks, tell me "replan my day".`;
        return new Response(streamTextResponse(responseText), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }

      await supabase.from('study_tasks').update({
        is_completed: true,
        completed_at: new Date().toISOString()
      }).eq('id', targetTask.id).eq('user_id', user.id);

      await LearningStateEngine.ingestEvent({
        userId: user.id,
        type: 'TASK_COMPLETED',
        data: { taskId: targetTask.id }
      });

      const responseText = `[System Command: MARK_COMPLETE]\n\nUpdating study task: **${targetTask.title}** to COMPLETED.\n- Ingested task completion telemetry into PULSE...\n- Knowledge retention & velocity metrics updated.\n\nKeep up the great momentum!`;
      return new Response(streamTextResponse(responseText), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }

    if (intent === 'UPDATE_MASTERY') {
      const subject = args.subject || 'General';
      const chapter = args.chapter || '';
      const correct = args.correct !== false; // default true if not specified

      const conceptId = await resolveConceptByName(user.id, subject, chapter);

      if (!conceptId) {
        const responseText = `[System Command: UPDATE_MASTERY]\n\nAttempted to update topic: **${chapter}**...\n- Unable to resolve this topic name in your active learning roadmap. Please check the exact topic name or define a goal first.`;
        return new Response(streamTextResponse(responseText), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }

      // Update concept state
      await updateConceptState(conceptId, correct, 0);

      // Ingest event to trigger reactive rules (prereq prioritize, card generation, replan)
      await LearningStateEngine.ingestEvent({
        userId: user.id,
        type: correct ? 'SESSION_COMPLETED' : 'QUIZ_ATTEMPTED',
        data: {
          conceptId,
          subject,
          chapter,
          isCorrect: correct,
          understandingGained: correct
        }
      });

      const responseText = `[System Command: UPDATE_MASTERY]\n\nResolved concept node: **${chapter}** (${subject})\n- ATLAS mastery status updated to: **${correct ? 'Proficient' : 'Struggling'}**\n- ${correct ? 'Spaced repetition revision cards scheduled in MEMORY.' : 'Seeding recovery cards and priority prereq study blocks for tomorrow.'}\n- Dynamic replanning triggered.\n\nAll systems fully updated.`;
      return new Response(streamTextResponse(responseText), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }

    if (intent === 'SCHEDULE_REVISION') {
      const subject = args.subject || 'General';
      const chapter = args.chapter || 'Revision';
      const front = args.front || `Review of ${chapter}`;
      const back = args.back || 'Self-explain core formulas.';

      // Get first concept id
      const conceptId = await resolveConceptByName(user.id, subject, chapter) || '';

      await createSingleCard(user.id, conceptId, front, back, subject, chapter);

      const responseText = `[System Command: SCHEDULE_REVISION]\n\nGenerating spaced retrieval card in MEMORY...\n- Front: "${front}"\n- Back: "${back}"\n\nRevision flashcard scheduled successfully. It will automatically queue up for practice based on FSRS-5 algorithms.`;
      return new Response(streamTextResponse(responseText), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }

    if (intent === 'DETECT_BURNOUT') {
      const state = args.emotionalState || 'overwhelmed';
      
      await logPulseSignal(user.id, state);

      // Log event to trigger skipped session / workload downscale rules
      await LearningStateEngine.ingestEvent({
        userId: user.id,
        type: 'PULSE_REPORTED',
        data: { emotionalState: state }
      });

      const responseText = `[System Command: DETECT_BURNOUT]\n\nPULSE telemetry signal recorded: **${state}**.\n- Cognitive load threshold adapted downwards.\n- Restructuring daily study hours parameter (-15%).\n- Rescheduling intense review blocks to allow recovery.\n\nI have adapted your plan to prioritize mental recovery. Please take a break and return when ready.`;
      return new Response(streamTextResponse(responseText), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }

    // 4. Default: Socratic MIND Engine
    const mindContext = await getMINDContext(user.id, message);
    const systemPrompt = getMINDSystemPrompt(mindContext, currentPath || '/dashboard');
    const userPrompt = buildMINDUserPrompt(recentHistoryText, message);

    const encoder = new TextEncoder();
    let fullResponse = '';

    const stream = new ReadableStream({
      async start(controller) {
        try {
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

          // Background Post-Session Synthesis (if user engaged in tutoring)
          if (fullResponse.trim().length > 0) {
            Promise.resolve().then(async () => {
              try {
                const analysisPrompt = `Analyze the student's recent exchange with the AI MIND tutor to check if they were studying/discussing a specific academic concept.
If yes, identify the subject (e.g. 'Physics'), the concept (e.g. 'Coulomb\'s Law'), check if they demonstrated understanding, and if any critical conceptual gaps were found.

Exchange:
${recentHistoryText}
Student: ${message}
MIND: ${fullResponse}

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

                let resolvedId: string | null = null;
                const db = await createClient();

                if (analysis.conceptDiscussed && analysis.subject && analysis.conceptName) {
                  resolvedId = await resolveConceptByName(user.id, analysis.subject, analysis.conceptName);
                }

                await db.from('tutor_sessions').insert({
                  user_id: user.id,
                  concept_id: resolvedId,
                  messages: [
                    ...(history || []),
                    { role: 'user', content: message },
                    { role: 'tutor', content: fullResponse }
                  ],
                  summary: analysis.summary || 'Study discussion.',
                  understanding_gained: analysis.understandingGained ? 1 : 0
                });

                if (resolvedId && analysis.understandingGained) {
                  await updateConceptState(resolvedId, true, 0);
                }

                if (resolvedId && analysis.gapFound && !analysis.understandingGained) {
                  await createSingleCard(
                    user.id,
                    resolvedId,
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
      }
    });

    return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  } catch (error: any) {
    logger.error('Critical failure in COMMAND orchestrator route', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
