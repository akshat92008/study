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
 
// ─── Capability Registry ────────────────────────────────────────────────────
// Single source of truth for what this OS can actually do.
// Used by COMMAND classifier AND injected into MIND context.
const CAPABILITY_REGISTRY = `
COGNITION OS — AVAILABLE CAPABILITIES:
 
• ATLAS (Cognition Graph): Tracks your mastery across all concepts. Shows which topics are strong, weak, or untested. Opens via the "ATLAS" pill in the toolbar.
• MEMORY (Spaced Repetition): Flashcard queue powered by FSRS-5 algorithm. Auto-schedules revision based on forgetting curves. Opens via the "MEMORY" pill in the toolbar.
• AUTOPSY (Mistake Diagnoser): Upload a mock test PDF/image. The system extracts your wrong answers, maps them to syllabus chapters, and diagnoses root cognitive failures. Opens via the "AUTOPSY" pill in the toolbar.
• COMMAND (AI Orchestrator): You are talking to it right now. It understands natural language and executes OS-level actions — creating roadmaps, replanning schedules, updating mastery, scheduling revision cards, and detecting burnout.
• ROADMAP / PLANNER: A structured day-by-day study plan generated from your goal, current level, and available hours. Visible in the left sidebar under "Learning Goals". Today's tasks appear at the top.
• TODAY'S TASKS: Study blocks for today are visible in the left sidebar once a goal is active. The planner auto-updates when tasks are completed or replanned.
• PULSE: Tracks your emotional and cognitive state. Detects fatigue patterns and adapts your workload accordingly.
• TUTOR / SOCRATIC MODE: The AI can teach any concept using the Socratic method — asking questions instead of just giving answers to build deeper understanding.
`;
 
// ─── Intent Detection Schema ─────────────────────────────────────────────────
const IntentDetectionSchema = z.object({
  intent: z.enum([
    'CREATE_GOAL',
    'REPLAN',
    'MARK_COMPLETE',
    'UPDATE_MASTERY',
    'SCHEDULE_REVISION',
    'DETECT_BURNOUT',
    'SHOW_FEATURE',
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
    emotionalState: z.enum(['focused', 'neutral', 'frustrated', 'overwhelmed']).optional(),
    featureName: z.enum(['atlas', 'memory', 'autopsy', 'roadmap', 'tasks', 'planner', 'pulse', 'tutor']).optional()
  }).optional()
});
 
// ─── Stream Helper ───────────────────────────────────────────────────────────
function streamTextResponse(text: string): ReadableStream {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      const words = text.split(' ');
      for (const word of words) {
        controller.enqueue(encoder.encode(word + ' '));
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      controller.close();
    }
  });
}
 
// ─── Route Handler ───────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response('Unauthorized', { status: 401 });
 
    const { message, history, currentPath } = await req.json();
 
    // 1. Format recent history for classifier context
    const recentHistoryText = (history || [])
      .slice(-6)
      .map((m: any) => `${m.role === 'user' ? 'Student' : 'COMMAND'}: ${m.content}`)
      .join('\n');
 
    // 2. Classify Student Intent
    const classificationPrompt = `
      You are COMMAND, the central operating system kernel of Cognition OS.
      Identify whether the student's message is an OS directive or general chat/tutoring.
 
      Intent types:
      - 'CREATE_GOAL': Student wants to create a new learning goal or roadmap. E.g., "create a goal to learn physics", "I want to prepare for NEET", "generate roadmap for JEE".
      - 'REPLAN': Student explicitly asks to replan or reschedule their day/tasks. E.g., "replan my schedule", "reschedule today", "update my plan".
      - 'MARK_COMPLETE': Student wants to mark a task as done. E.g., "done with the first task", "mark Laws of Motion as complete".
      - 'UPDATE_MASTERY': Student reports their topic understanding status. E.g., "I mastered Electrostatics", "I'm weak in centripetal force", "I finally understand Gauss Law".
      - 'SCHEDULE_REVISION': Student wants to add a flashcard or revision item. E.g., "remind me to revise Mitochondria", "create flashcard for dot product".
      - 'DETECT_BURNOUT': Student reports stress, burnout, fatigue, or needs a break. E.g., "I'm overwhelmed", "I feel stressed", "give me a break".
      - 'SHOW_FEATURE': Student is asking WHERE something is, CAN'T SEE something, or wants to OPEN a feature. E.g., "where is roadmap", "I can't see my tasks", "show me my atlas", "open memory", "where are my today's goals", "I can't see anything".
      - 'TUTOR_SESSION': Student is asking an academic question or wants tutoring.
      - 'GENERAL_CHAT': Greetings, questions about what the product does, friendly chat, or requests that don't fit above.
 
      Arguments to extract:
      - CREATE_GOAL: 'title', 'deadline' (YYYY-MM-DD, default 6 months from now), 'currentLevel' (default 'intermediate'), 'timeAvailable' (daily hours, default 4), 'preferredLearningStyle' (default 'visual').
      - REPLAN: 'date' (YYYY-MM-DD, default today).
      - MARK_COMPLETE: 'taskId' or 'title'.
      - UPDATE_MASTERY: 'subject', 'chapter', 'correct' (true if mastered, false if struggling).
      - SCHEDULE_REVISION: 'subject', 'chapter', 'front', 'back'.
      - DETECT_BURNOUT: 'emotionalState'.
      - SHOW_FEATURE: 'featureName' — one of: 'atlas', 'memory', 'autopsy', 'roadmap', 'tasks', 'planner', 'pulse', 'tutor'.
 
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
 
    // ── CREATE_GOAL ──────────────────────────────────────────────────────────
    if (intent === 'CREATE_GOAL') {
      const title = args.title || 'Academic Mastery';
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
 
      await LearningStateEngine.ingestEvent({
        userId: user.id,
        type: 'SESSION_COMPLETED',
        data: { title, goalId: result.goalId, isGoalInit: true }
      });
 
      const responseText = `Your learning system is now active.\n\n**Goal: ${title}**\n\nI've built your personalized roadmap with milestones and seeded your concept graph in ATLAS. Your sidebar has been updated with today's study blocks.\n\nHere's what's ready for you:\n- 🧠 **ATLAS** — Your concept mastery map (tap the ATLAS pill above)\n- 🃏 **MEMORY** — Spaced repetition cards will queue as you study\n- 🔬 **AUTOPSY** — Upload mock tests anytime to diagnose mistakes\n\nWhere do you want to start today?`;
      return new Response(streamTextResponse(responseText), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
 
    // ── REPLAN ───────────────────────────────────────────────────────────────
    if (intent === 'REPLAN') {
      const todayStr = new Date().toISOString().split('T')[0];
      const date = args.date || todayStr;
 
      await LearningStateEngine.replanForUser(user.id, date);
 
      const responseText = `Done — I've reorganized today's study plan based on your current progress and retention data.\n\nYour updated tasks for **${date}** are now visible in the left sidebar. The order has been optimized by mastery priority and spaced repetition curves.\n\nReady to begin? Just say "let's start" or ask me about any topic on today's list.`;
      return new Response(streamTextResponse(responseText), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
 
    // ── MARK_COMPLETE ────────────────────────────────────────────────────────
    if (intent === 'MARK_COMPLETE') {
      const todayStr = new Date().toISOString().split('T')[0];
      const startOfDay = new Date(new Date(todayStr).setHours(0, 0, 0, 0)).toISOString();
 
      const { data: tasks } = await supabase
        .from('study_tasks')
        .select('*')
        .eq('user_id', user.id)
        .eq('scheduled_date', startOfDay)
        .eq('is_completed', false);
 
      let targetTask = null;
      if (tasks && tasks.length > 0) {
        if (args.title) targetTask = tasks.find(t => t.title.toLowerCase().includes(args.title!.toLowerCase()));
        if (!targetTask && args.taskId) targetTask = tasks.find(t => t.id === args.taskId);
        if (!targetTask) targetTask = tasks[0];
      }
 
      if (!targetTask) {
        const responseText = `I didn't find any incomplete tasks scheduled for today. If you'd like to plan new study blocks, just say "replan my day" and I'll rebuild your schedule.`;
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
 
      const responseText = `Marked **${targetTask.title}** as complete. Great progress!\n\nYour momentum metrics have been updated. What's next — shall I quiz you on this topic to lock in retention, or move to the next task?`;
      return new Response(streamTextResponse(responseText), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
 
    // ── UPDATE_MASTERY ───────────────────────────────────────────────────────
    if (intent === 'UPDATE_MASTERY') {
      const subject = args.subject || 'General';
      const chapter = args.chapter || '';
      const correct = args.correct !== false;
 
      const conceptId = await resolveConceptByName(user.id, subject, chapter);
 
      if (!conceptId) {
        const responseText = `I couldn't find **${chapter}** in your active learning roadmap. This can happen if no goal has been created yet, or if the topic name differs slightly from your syllabus.\n\nTry creating a goal first, or tell me the exact chapter name as it appears in your syllabus.`;
        return new Response(streamTextResponse(responseText), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }
 
      await updateConceptState(conceptId, correct, 0);
 
      await LearningStateEngine.ingestEvent({
        userId: user.id,
        type: correct ? 'SESSION_COMPLETED' : 'QUIZ_ATTEMPTED',
        data: { conceptId, subject, chapter, isCorrect: correct, understandingGained: correct }
      });
 
      const responseText = correct
        ? `Got it — **${chapter}** (${subject}) is marked as Proficient in your ATLAS graph. A spaced repetition card has been scheduled in MEMORY to make sure this sticks.\n\nWant me to test you on an edge case to really cement it?`
        : `Noted — **${chapter}** (${subject}) is flagged as a weak area in ATLAS. I've prioritized recovery study blocks and added foundation cards to your MEMORY queue.\n\nShall we work through the concept together right now?`;
      return new Response(streamTextResponse(responseText), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
 
    // ── SCHEDULE_REVISION ────────────────────────────────────────────────────
    if (intent === 'SCHEDULE_REVISION') {
      const subject = args.subject || 'General';
      const chapter = args.chapter || 'Revision';
      const front = args.front || `Review of ${chapter}`;
      const back = args.back || 'Self-explain the core formulas and mechanisms.';
 
      const conceptId = await resolveConceptByName(user.id, subject, chapter) || '';
      await createSingleCard(user.id, conceptId, front, back, subject, chapter);
 
      const responseText = `Revision card added to your **MEMORY** queue.\n\n**Front:** ${front}\n**Back:** ${back}\n\nIt'll surface at the optimal time based on your forgetting curve. You can also open MEMORY right now from the toolbar to review all pending cards.`;
      return new Response(streamTextResponse(responseText), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
 
    // ── DETECT_BURNOUT ───────────────────────────────────────────────────────
    if (intent === 'DETECT_BURNOUT') {
      const state = args.emotionalState || 'overwhelmed';
 
      await logPulseSignal(user.id, state);
 
      await LearningStateEngine.ingestEvent({
        userId: user.id,
        type: 'PULSE_REPORTED',
        data: { emotionalState: state }
      });
 
      const recoveryMessages: Record<string, string> = {
        overwhelmed: `That's completely valid — feeling overwhelmed is your brain signaling it needs recovery, not more pressure.\n\nI've lightened today's workload by 15% and moved intense review blocks to tomorrow. Today's tasks are now gentler, lower-stakes material.\n\nTake a proper break — even 20 minutes helps. Come back when you're ready and we'll ease back in.`,
        frustrated: `Frustration usually means you're working at the edge of your understanding — that's actually where growth happens.\n\nI've removed time pressure from today's remaining tasks. Let's slow down and work through whatever is blocking you. What topic is giving you trouble?`,
        focused: `You're in a strong state right now — let's make the most of it.\n\nI've surfaced your highest-priority, highest-impact tasks for today. Want to dive into the hardest material while your focus is sharp?`,
        neutral: `Understood. I've logged your current state. Your plan remains unchanged — let me know if you'd like me to adjust intensity in either direction.`
      };
 
      const responseText = recoveryMessages[state] || recoveryMessages['overwhelmed'];
      return new Response(streamTextResponse(responseText), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
 
    // ── SHOW_FEATURE ─────────────────────────────────────────────────────────
    // This intent fires when a user says "where is X", "I can't see X", "show me X".
    // We return a human response + an invisible [ACTION] token the frontend parses
    // to programmatically open the correct drawer/panel.
    if (intent === 'SHOW_FEATURE') {
      const feature = args.featureName || 'atlas';
 
      const featureGuides: Record<string, { drawer: string; response: string }> = {
        atlas: {
          drawer: 'cognition',
          response: `Opening your **ATLAS Cognition Graph** now.\n\nATLAS shows your mastery across all concepts in your roadmap — green means strong, red means weak, grey means not tested yet. You can click any concept node to see its details and linked prerequisites.\n\nRight now it's showing your full knowledge map. Use it to spot gaps or decide where to study next.`
        },
        memory: {
          drawer: 'revision',
          response: `Opening your **MEMORY Queue** now.\n\nMEMORY uses spaced repetition (FSRS-5 algorithm) to surface cards at exactly the right moment before you'd forget them. Work through the cards in order — rating each one honestly is how the algorithm learns your retention pace.`
        },
        autopsy: {
          drawer: 'autopsy',
          response: `Opening **AUTOPSY** now.\n\nTo use it, drag and drop a mock test PDF or image into the upload zone. The system will extract your wrong answers, map them to syllabus chapters, and diagnose the root cognitive failure behind each mistake — not just what you got wrong, but *why*.`
        },
        roadmap: {
          drawer: 'cognition',
          response: `Your roadmap lives in two places:\n\n1. **Left sidebar** — Shows your active learning goal with today's study tasks listed below it. If you don't see tasks, your plan may not be initialized yet. Try saying "replan my day".\n\n2. **ATLAS panel** (opening now) — Shows the full concept graph with your progress visualized as a knowledge map.\n\nIf you've just created a goal and nothing is showing, give the page a quick refresh.`
        },
        tasks: {
          drawer: null as any,
          response: `Your **today's tasks** are in the **left sidebar** under your active goal name. Each block shows the topic, estimated time, and completion status.\n\nIf the sidebar shows no tasks, try saying "replan my day" — I'll rebuild today's schedule from your current mastery data.\n\nIf you don't have an active goal yet, start by telling me what you're preparing for (e.g., "help me prepare for JEE Advanced").`
        },
        planner: {
          drawer: null as any,
          response: `Your **daily plan** is visible in the left sidebar once a learning goal is active. Each task is a study block I've scheduled based on your mastery gaps and available hours.\n\nSay "replan my day" if you'd like me to rebuild the schedule, or "I completed [task name]" to mark items done.`
        },
        pulse: {
          drawer: null as any,
          response: `**PULSE** tracks your cognitive and emotional state over time. It picks up signals from how you report feeling ("I'm overwhelmed", "I'm stressed") and adapts your workload automatically.\n\nYou can check your PULSE dashboard in the top navigation under the Analytics section.`
        },
        tutor: {
          drawer: null as any,
          response: `I'm your tutor — you're already talking to me! Just ask any academic question and I'll guide you through it using the Socratic method.\n\nFor a more focused tutoring session, head to the **Tutor** page in the left navigation where you'll get a dedicated interface.`
        }
      };
 
      const guide = featureGuides[feature] || featureGuides['atlas'];
      // Append invisible action token for frontend to parse
      const actionToken = guide.drawer ? `\n[ACTION:OPEN_DRAWER:${guide.drawer}]` : '';
      const fullResponse = guide.response + actionToken;
 
      return new Response(streamTextResponse(fullResponse), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
 
    // ── GENERAL_CHAT / TUTOR_SESSION → MIND Engine ───────────────────────────
    const mindContext = await getMINDContext(user.id, message);
    const systemPrompt = getMINDSystemPrompt(mindContext, currentPath || '/dashboard', CAPABILITY_REGISTRY);
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
          controller.enqueue(encoder.encode('\n\nI hit a temporary snag — please try again in a moment.'));
        } finally {
          controller.close();
 
          // Background Post-Session Synthesis
          if (fullResponse.trim().length > 0) {
            Promise.resolve().then(async () => {
              try {
                const analysisPrompt = `Analyze the student's recent exchange with the AI MIND tutor to check if they were studying/discussing a specific academic concept.
If yes, identify the subject (e.g. 'Physics'), the concept (e.g. 'Coulomb\\'s Law'), check if they demonstrated understanding, and if any critical conceptual gaps were found.
 
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
