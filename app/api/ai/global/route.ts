import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { streamText, generateJSON } from '@/lib/ai/gemini';
import { getMINDContext } from '@/lib/engines/mind-engine';
import { getMINDSystemPrompt } from '@/lib/ai/prompts/mind-prompt';
import { updateConceptState } from '@/lib/engines/cognition-graph';
import { createSingleCard } from '@/lib/engines/revision-engine';
import { logger } from '@/lib/utils/logger';
import { CommandPlanner } from '@/lib/engines/command-engine';
import { LearningStateEngine } from '@/lib/engines/learning-state-engine';
import { logPulseSignal } from '@/lib/engines/pulse-engine';
import { resolveConceptByName } from '@/lib/engines/concept-resolver';
import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { rateLimit } from '@/lib/utils/rate-limit';
import { OrchestratorService } from '@/services/orchestrator.service';

const CAPABILITY_REGISTRY = `
COGNITION OS CAPABILITIES:
- ATLAS: Your concept mastery map across all subjects
- MEMORY: FSRS-5 spaced repetition flashcard queue
- AUTOPSY: Upload any mock test PDF/image for full cognitive diagnosis
- COMMAND: Natural language OS control — create goals, replan, mark complete
- PULSE: Mental state tracking, burnout detection, workload adaptation
- TUTOR: Socratic teaching mode for deep understanding
`;

const IntentDetectionSchema = z.object({
  intent: z.enum([
    'CREATE_GOAL', 'REPLAN', 'MARK_COMPLETE', 'UPDATE_MASTERY',
    'SCHEDULE_REVISION', 'DETECT_BURNOUT', 'SHOW_FEATURE',
    'TUTOR_SESSION', 'GENERAL_CHAT'
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

// Real streaming from text — no fake word-by-word setTimeout
function createTextStream(text: string): ReadableStream {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    }
  });
}

// Handle image message via Gemini multimodal
async function processImageMessage(
  imageBase64: string,
  imageMimeType: string,
  message: string,
  mindContext: any,
  systemPrompt: string
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

  const contextBlock = `
STUDENT CONTEXT:
Exam: ${mindContext.profile.examType}
Exam Date: ${mindContext.profile.examDate}
Weak Areas: ${mindContext.weakConcepts.slice(0, 3).map((c: any) => c.name).join(', ') || 'None identified yet'}
Recent Mistakes: ${mindContext.struggles.slice(0, 2).map((s: any) => s.chapter).join(', ') || 'None'}

INSTRUCTIONS:
1. Solve the question in the image completely, step by step.
2. Explain the concept behind it clearly.
3. Note how this specific question type appears in ${mindContext.profile.examType} exams.
4. If the student has shown weakness in this area, flag it.
5. End with one follow-up question to test retention.

Student's message: ${message}
`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType: imageMimeType, data: imageBase64 } },
        { text: contextBlock }
      ]
    }],
    config: { temperature: 0.4 }
  });

  return response.text || 'I could not read the image clearly. Please try a clearer photo with better lighting.';
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response('Unauthorized', { status: 401 });

    const isAllowed = await rateLimit(`global-${user.id}`, 60, 60 * 60 * 1000);
    if (!isAllowed) return new Response('Rate limit exceeded. Please wait before sending more messages.', { status: 429 });

    const { message, history, activeGoalId, imageBase64, imageMimeType } = await req.json();

    // ── IMAGE PATH: multimodal Gemini, skip intent classification ───────────
    if (imageBase64 && imageMimeType) {
      const mindContext = await getMINDContext(user.id, message || 'Solve this question');
      const systemPrompt = getMINDSystemPrompt(mindContext);

      try {
        const answer = await processImageMessage(imageBase64, imageMimeType, message || 'Solve this', mindContext, systemPrompt);
        return new Response(createTextStream(answer), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      } catch (imgErr: any) {
        logger.error('Image processing failed', imgErr);
        return new Response(createTextStream('I had trouble reading that image. Try taking a clearer photo with good lighting, or type the question instead.'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }
    }

    // ── TEXT PATH ────────────────────────────────────────────────────────────

    const recentHistoryText = (history || [])
      .slice(-6)
      .map((m: any) => `${m.role === 'user' ? 'Student' : 'OS'}: ${m.content.slice(0, 200)}`)
      .join('\n');

    // Intent classification
    const classificationPrompt = `
You are COMMAND, the OS kernel of Cognition OS.
Classify the student's intent. Return ONE intent type.

Intent types:
- CREATE_GOAL: wants to create a learning goal or roadmap
- REPLAN: wants to reschedule their day
- MARK_COMPLETE: wants to mark a task done
- UPDATE_MASTERY: reports topic understanding (mastered/struggling)
- SCHEDULE_REVISION: wants to add a flashcard/reminder
- DETECT_BURNOUT: expresses stress/overwhelm/fatigue/anxiety/fear
- SHOW_FEATURE: asks where something is or wants to open a feature
- TUTOR_SESSION: asking an academic or subject-matter question
- GENERAL_CHAT: greetings, meta questions, anything else

Recent history:
${recentHistoryText}

Current message: "${message}"

Return JSON only.`;

    const detection = await generateJSON<z.infer<typeof IntentDetectionSchema>>(
      'flash',
      'You are an intent classifier. Return valid JSON only.',
      classificationPrompt,
      IntentDetectionSchema
    );

    const intent = detection?.intent || 'GENERAL_CHAT';
    const args = detection?.arguments || {};
    logger.info('Intent classified', { intent });

    // ── CREATE_GOAL ──────────────────────────────────────────────────────────
    if (intent === 'CREATE_GOAL') {
      const title = args.title || 'Academic Mastery';
      let deadline = args.deadline;
      if (!deadline || isNaN(Date.parse(deadline))) {
        const d = new Date(); d.setMonth(d.getMonth() + 6);
        deadline = d.toISOString().split('T')[0];
      }

      const planner = new CommandPlanner();
      const result = await planner.initializeGoalRoadmap(user.id, {
        title,
        deadline,
        currentLevel: args.currentLevel || 'intermediate',
        timeAvailable: args.timeAvailable || 4,
        preferredLearningStyle: args.preferredLearningStyle || 'visual',
        uploadedMaterialIds: []
      });

      await LearningStateEngine.ingestEvent({ userId: user.id, type: 'SESSION_COMPLETED', data: { title, goalId: result.goalId, isGoalInit: true } });

      const daysToExam = Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      const responseText = `Your learning system is now live.\n\n**Goal: ${title}**\n**${daysToExam} days to your deadline.**\n\nI've built your personalized roadmap with ${result.conceptsCount} concepts across ${result.milestonesCount} milestones. Your knowledge graph is seeded in ATLAS.\n\n**What's ready:**\n- 🧠 ATLAS — your concept map (tap the ATLAS pill)\n- 🃏 MEMORY — flashcards will auto-generate as you study\n- 🔬 AUTOPSY — drop any mock test anytime for full diagnosis\n- 📋 Today's session card is in your sidebar\n\nWhere do you want to start?`;

      return new Response(createTextStream(responseText), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }

    // ── REPLAN ───────────────────────────────────────────────────────────────
    if (intent === 'REPLAN') {
      const allowed = await rateLimit(`planner-${user.id}`, 5, 24 * 60 * 60 * 1000);
      if (!allowed) {
        return new Response(createTextStream("You've replanned 5 times today — that's the limit to keep your schedule stable. Your current plan is optimized. I'll refresh it overnight. What else can I help with?"), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }
      const date = args.date || new Date().toISOString().split('T')[0];
      await LearningStateEngine.replanForUser(user.id, date);
      return new Response(createTextStream(`Done — your plan for **${date}** has been rebuilt based on your current mastery data and due flashcards. Check your sidebar for the updated session. Ready to start?`), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }

    // ── MARK_COMPLETE ────────────────────────────────────────────────────────
    if (intent === 'MARK_COMPLETE') {
      const todayStr = new Date().toISOString().split('T')[0];
      const { data: tasks } = await supabase.from('study_tasks').select('*')
        .eq('user_id', user.id).eq('scheduled_date', todayStr).eq('is_completed', false);

      let targetTask = null;
      if (tasks?.length) {
        if (args.title) targetTask = tasks.find(t => t.title.toLowerCase().includes(args.title!.toLowerCase()));
        if (!targetTask) targetTask = tasks[0];
      }

      if (!targetTask) {
        return new Response(createTextStream("No incomplete tasks found for today. Say \"replan my day\" if you want me to rebuild your schedule."), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }

      await supabase.from('study_tasks').update({ is_completed: true, completed_at: new Date().toISOString() }).eq('id', targetTask.id).eq('user_id', user.id);
      await LearningStateEngine.ingestEvent({ userId: user.id, type: 'TASK_COMPLETED', data: { taskId: targetTask.id } });

      return new Response(createTextStream(`**${targetTask.title}** marked complete. Solid progress.\n\nWant me to quiz you on it to lock in retention, or shall we move to the next task?`), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }

    // ── UPDATE_MASTERY ───────────────────────────────────────────────────────
    if (intent === 'UPDATE_MASTERY') {
      const subject = args.subject || 'General';
      const chapter = args.chapter || '';
      const correct = args.correct !== false;
      const conceptId = await resolveConceptByName(user.id, subject, chapter);

      if (!conceptId) {
        return new Response(createTextStream(`I couldn't find **${chapter}** in your active roadmap. Create a goal first, or check the exact chapter name in ATLAS.`), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }

      await updateConceptState(conceptId, correct, 0);
      await LearningStateEngine.ingestEvent({ userId: user.id, type: correct ? 'SESSION_COMPLETED' : 'QUIZ_ATTEMPTED', data: { conceptId, subject, chapter, isCorrect: correct } });

      const text = correct
        ? `Got it — **${chapter}** marked Proficient in ATLAS. A revision card has been scheduled in MEMORY so this sticks. Want me to test you on an edge case to really cement it?`
        : `Noted — **${chapter}** flagged as weak in ATLAS. I've prioritized recovery blocks in your plan and added foundation cards to MEMORY. Shall we work through it together right now?`;

      return new Response(createTextStream(text), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }

    // ── SCHEDULE_REVISION ────────────────────────────────────────────────────
    if (intent === 'SCHEDULE_REVISION') {
      const subject = args.subject || 'General';
      const chapter = args.chapter || 'Revision';
      const front = args.front || `Review: ${chapter}`;
      const back = args.back || 'Self-explain the core concept and key formulas.';
      const conceptId = await resolveConceptByName(user.id, subject, chapter) || '';
      await createSingleCard(user.id, conceptId, front, back, subject, chapter);
      return new Response(createTextStream(`Revision card added to **MEMORY**.\n\n**Front:** ${front}\n**Back:** ${back}\n\nIt'll surface at exactly the right moment based on your forgetting curve.`), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }

    // ── DETECT_BURNOUT ───────────────────────────────────────────────────────
    if (intent === 'DETECT_BURNOUT') {
      const state = args.emotionalState || 'overwhelmed';
      await logPulseSignal(user.id, state);
      await LearningStateEngine.ingestEvent({ userId: user.id, type: 'PULSE_REPORTED', data: { emotionalState: state } });

      // Pull actual data to respond with facts, not generic motivation
      const { data: profile } = await supabase.from('profiles').select('streak_days, exam_date').eq('id', user.id).single();
      const { count: masteredCount } = await supabase.from('concepts').select('*', { count: 'exact', head: true }).eq('user_id', user.id).in('mastery', ['mastered', 'automated']);
      const daysToExam = profile?.exam_date ? Math.ceil((new Date(profile.exam_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;

      const recoveryMessages: Record<string, string> = {
        overwhelmed: `That is your brain signaling recovery time, not weakness.\n\nI've reduced today's workload by 30% and moved high-intensity sessions to tomorrow. Your current plan is now lighter and lower-stakes.\n\n${masteredCount ? `You've already mastered ${masteredCount} concepts. That progress is real and it's not going anywhere.` : ''} ${daysToExam ? `You have ${daysToExam} days — enough time to breathe and still win. ` : ''}Take a proper break. 20 minutes is enough. Come back when you're ready.`,
        frustrated: `Frustration means you're right at the edge of your understanding — that's exactly where growth happens.\n\nI've removed time pressure from today's remaining tasks. Let's slow down and work through whatever is blocking you. What specific concept or topic has you stuck?`,
        focused: `You're in a strong state right now — let's make the most of it.\n\nI've pulled your highest-priority, highest-impact tasks to the top of today's plan. Want to tackle the hardest material while your focus is sharp?`,
        neutral: `Logged. Your plan stays unchanged for now. Let me know if you want me to adjust intensity in either direction.`
      };

      return new Response(createTextStream(recoveryMessages[state] || recoveryMessages['overwhelmed']), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }

    // ── SHOW_FEATURE ─────────────────────────────────────────────────────────
    if (intent === 'SHOW_FEATURE') {
      const feature = args.featureName || 'atlas';
      const featureGuides: Record<string, { drawer?: string; response: string }> = {
        atlas: { drawer: 'cognition', response: `Opening **ATLAS** — your live knowledge map.\n\nGreen nodes are mastered, red are weak, grey are untested. Click any node to see its details and prerequisites. Use this to decide where your next session should focus.` },
        memory: { drawer: 'revision', response: `Opening **MEMORY** — your flashcard queue.\n\nCards are ordered by forgetting curve — the most at-risk concepts surface first. Rate each card honestly; that's how the FSRS-5 algorithm learns your exact retention pace.` },
        autopsy: { drawer: 'autopsy', response: `Opening **AUTOPSY**.\n\nDrag and drop any mock test (PDF, photo, OMR scan) into the upload zone. I'll extract every wrong answer, map each mistake to a syllabus chapter, diagnose the root cognitive failure, and generate a 3-day recovery sprint plan.` },
        roadmap: { drawer: 'cognition', response: `Your roadmap is in two places:\n\n1. **Left sidebar** — today's study tasks under your active goal\n2. **ATLAS panel** (opening now) — full concept graph with progress\n\nIf you don't see tasks, say "replan my day" and I'll rebuild your schedule.` },
        tasks: { response: `Your **today's tasks** are in the left sidebar under your active goal. If you see nothing, say "replan my day" — I'll rebuild the schedule from your current mastery data.` },
        pulse: { response: `**PULSE** reads your behavioral signals continuously — session length, accuracy, task completion patterns — and adapts your workload. When you report feeling overwhelmed, it reduces targets. You can see your cognitive trends in the Analytics section.` },
        tutor: { response: `I am your tutor. You're already talking to me.\n\nJust ask any academic question — I'll teach it through the Socratic method, referencing your specific weak areas and exam pattern. For a focused session, the dedicated Tutor page in the sidebar has a full Socratic interface.` }
      };

      const guide = featureGuides[feature] || featureGuides['atlas'];
      const actionToken = guide.drawer ? `\n[ACTION:OPEN_DRAWER:${guide.drawer}]` : '';
      return new Response(createTextStream(guide.response + actionToken), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }

    // ── GENERAL_CHAT / TUTOR_SESSION → Orchestrator ───────────────────────
    const orchestrator = new OrchestratorService();
    const encoder = new TextEncoder();
    let fullResponse = '';

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const generator = await orchestrator.processUserMessage(user.id, message, history, activeGoalId, intent);
          for await (const chunk of generator) {
            controller.enqueue(encoder.encode(chunk));
            fullResponse += chunk;
          }

          // ── POST-SESSION SYNTHESIS (MIND → ATLAS + MEMORY) ──────────────
          // Runs BEFORE controller.close() so Vercel doesn't kill the function early
          if (fullResponse.trim().length > 50) {
            try {
              const analysisPrompt = `Analyze this AI tutor exchange. Did the student discuss a specific academic concept?

Exchange:
Student: ${message}
Tutor: ${fullResponse.slice(0, 2000)}

Return JSON:
{
  "conceptDiscussed": boolean,
  "subject": string | null,
  "conceptName": string | null,
  "understandingGained": boolean,
  "gapFound": string | null,
  "gapAnswer": string | null,
  "summary": string
}`;

              const analysis = await generateJSON<any>('flash', 'You are a learning diagnostic engine. Return valid JSON only.', analysisPrompt);

              if (analysis?.conceptDiscussed && analysis.subject && analysis.conceptName) {
                const resolvedId = await resolveConceptByName(user.id, analysis.subject, analysis.conceptName);
                if (resolvedId) {
                  if (analysis.understandingGained) {
                    await updateConceptState(resolvedId, true, 0);
                  } else if (analysis.gapFound) {
                    await createSingleCard(
                      user.id, resolvedId,
                      analysis.gapFound,
                      analysis.gapAnswer || 'Review your notes on this topic.',
                      analysis.subject, analysis.conceptName
                    );
                  }
                }
              }
            } catch (bgErr) {
              logger.error('Post-session synthesis failed', bgErr);
              // Non-blocking — student still got their response
            }
          }
        } catch (err: any) {
          logger.error('Orchestrator streaming error', err);
          controller.enqueue(encoder.encode('\n\nI hit a temporary issue — please try again.'));
        } finally {
          controller.close(); // close LAST — after synthesis completes
        }
      }
    });

    return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });

  } catch (error: any) {
    logger.error('Critical failure in COMMAND route', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
