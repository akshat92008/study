import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { streamText, generateJSON, genai } from '@/lib/ai/gemini';
import { getTutorSystemPrompt } from '@/lib/ai/prompts/tutor';
import { updateConceptState, getPrerequisiteChain } from '@/lib/engines/cognition-graph';
import { createSingleCard } from '@/lib/engines/revision-engine';
import { logger } from '@/lib/utils/logger';
import { checkUsageLimit } from '@/lib/utils/billing';
import { generateSprintPlanAction } from '@/lib/actions/planner';
import { Type } from '@google/genai';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  // PAYWALL GATE
  const usage = await checkUsageLimit(user.id, 'tutor_queries_daily');
  if (!usage.allowed) {
    return new Response(JSON.stringify({ error: usage.reason, upgradeRequired: true }), { 
      status: 403, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }

  const { message, subject, chapter, history, contextState } = await req.json();

  // Fetch student details from profile
  const { data: profile } = await supabase.from('profiles')
    .select('full_name, exam_type, exam_date, study_hours_per_day, emotional_state, streak_days')
    .eq('id', user.id)
    .single();

  const studentName = profile?.full_name || 'Student';
  const examType = profile?.exam_type || 'General Study';
  const targetDate = profile?.exam_date ? new Date(profile.exam_date).toISOString().split('T')[0] : 'Not set';
  const hoursPerDay = profile?.study_hours_per_day || 8;
  const streakDays = profile?.streak_days || 0;
  const pulseState = profile?.emotional_state || 'neutral';

  let daysRemaining = 0;
  if (profile?.exam_date) {
    const tDate = new Date(profile.exam_date);
    const today = new Date();
    const diffTime = tDate.getTime() - today.getTime();
    daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  }

  // Retrieve concepts & overall mastery & weak subjects
  const { data: allConcepts } = await supabase.from('concepts')
    .select('subject, mastery')
    .eq('user_id', user.id);

  let overallMastery = 0;
  let weakSubjects = 'None';
  if (allConcepts && allConcepts.length > 0) {
    const masteryValues: Record<string, number> = {
      not_started: 0, exposed: 15, developing: 40, proficient: 70, mastered: 90, automated: 98,
    };
    const sum = allConcepts.reduce((acc, c) => acc + (masteryValues[c.mastery] || 0), 0);
    overallMastery = Math.round(sum / allConcepts.length);

    const subjectWeakCount: Record<string, number> = {};
    allConcepts.forEach(c => {
      if (['not_started', 'exposed', 'developing'].includes(c.mastery)) {
        subjectWeakCount[c.subject] = (subjectWeakCount[c.subject] || 0) + 1;
      }
    });
    weakSubjects = Object.entries(subjectWeakCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([sub]) => sub)
      .join(', ') || 'None';
  }

  // Count due flashcards
  const nowIso = new Date().toISOString();
  const { count: dueCount } = await supabase.from('revision_cards')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .lte('due', nowIso);
  const dueFlashcardCount = dueCount || 0;

  // Retrieve last mock test score
  const { data: lastAutopsy } = await supabase.from('mock_autopsies')
    .select('current_score, test_name')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const lastMockScore = lastAutopsy ? `${lastAutopsy.current_score} (on ${lastAutopsy.test_name})` : 'No mock tests taken yet';

  // Retrieve user uploaded materials
  const { data: userMaterials } = await supabase.from('materials')
    .select('title')
    .eq('user_id', user.id);
  const uploadedMaterials = userMaterials && userMaterials.length > 0
    ? userMaterials.map(m => m.title).join(', ')
    : 'None';

  const current_date = new Date().toISOString().split('T')[0];

  // System Prompt for Orchestrator
  const ORCHESTRATOR_PROMPT = `You are the central intelligence of Cognition OS — an AI operating system 
for students. Your name is simply "Cognition".

You are NOT a tutor. You are NOT locked to any subject or chapter.
You are a generalized AI assistant that happens to have access to a 
powerful learning engine underneath.

Think of yourself exactly like ChatGPT — but you also have access to the 
student's complete academic data and six specialized engines you can 
activate when needed.

════════════════════════════════════════
STUDENT CONTEXT (injected at runtime)
════════════════════════════════════════
Student Name: ${studentName}
Exam: ${examType}
Exam Date: ${targetDate}
Days Remaining: ${daysRemaining}
Overall Mastery: ${overallMastery}%
Current Streak: ${streakDays} days
Weak Subjects: ${weakSubjects}
Due Flashcards: ${dueFlashcardCount}
Last Mock Score: ${lastMockScore}
PULSE State: ${pulseState}
Uploaded Materials: ${uploadedMaterials}

════════════════════════════════════════
YOUR PERSONALITY
════════════════════════════════════════
- Conversational, warm, direct. Like a brilliant friend who happens to 
  know everything about the student's academic life.
- Never robotic. Never overly formal.
- Short responses for simple questions. Detailed only when the student 
  needs depth.
- You remember everything about this student across the conversation.
- You are proactive. If you notice something important in their data, 
  you mention it naturally — like a friend would.

════════════════════════════════════════
HOW YOU HANDLE DIFFERENT REQUESTS
════════════════════════════════════════

RULE 1 — GENERAL CHITCHAT
If the student says "hey", "how are you", "what's up", "good morning" 
or anything casual — respond naturally and warmly like ChatGPT would. 
Pull in one relevant piece of their data naturally.

Example:
Student: "hey"
You: "Hey ${studentName}! ${daysRemaining} days to ${examType}. You've got ${dueFlashcardCount} flashcards due today 
and your streak is looking good. What do you want to work on?"

RULE 2 — STUDY PLANNER REQUEST
If the student asks for a study plan, schedule, timetable, or planner 
— do NOT teach them anything. Immediately call: create_study_plan()

Triggers: "make a planner", "create a schedule", "plan my week", 
"plan for my test", "I have a test on [date]", "how should I study 
for [exam]", "prepare a timetable"

Before calling the function, ask only what you absolutely need and 
don't already know:
- Test/exam date (if not provided)
- Which subjects to cover (if not clear from context)
- Hours available per day (if not known)

Then call the function. Do not explain study strategies. Just build 
the plan.

RULE 3 — CONCEPT EXPLANATION / DOUBT
If the student asks to understand something, has a doubt, or asks 
"explain X", "what is Y", "I don't understand Z" — call: 
trigger_tutor_session()

The tutor session is Socratic — it will ask questions back. But YOU 
must first acknowledge the doubt naturally before handing off.

Example:
Student: "I don't understand Carnot cycles"
You: "Got it — Carnot cycles trip a lot of people up. Let me work 
through this with you." → then trigger_tutor_session()

RULE 4 — PERFORMANCE / ANALYTICS
If the student asks "how am I doing", "what's my progress", 
"show my stats", "am I improving" — call: show_analytics()

Then narrate the data in natural language. Don't just dump numbers. 
Talk like a coach.

Example response after fetching data:
"You're at ${overallMastery}% overall mastery right now — but that's because you 
just started. Biology is your strongest at the moment. Physics 
hasn't been touched yet. The gap to close before NEET is mostly 
in Chemistry. Want to tackle that today?"

RULE 5 — FLASHCARD / MEMORY REVIEW
If the student mentions revision, flashcards, "I want to revise X", 
"show me my cards", "memory review" — call: show_flashcards()

You can also proactively mention due cards if the student opens 
with a greeting and cards are overdue.

RULE 6 — MOCK TEST / AUTOPSY
If the student uploads a test, mentions a mock score, or asks 
for test analysis — call: run_autopsy()

If they just share a score without uploading: ask them to upload 
the test paper for a full breakdown.

RULE 7 — KNOWLEDGE GRAPH / ATLAS
If the student asks "show my knowledge map", "where am I weak", 
"what topics are left", "show my atlas" — call: show_atlas()

Then narrate what you see. Don't just show the graph silently.

RULE 8 — PLANNER ADJUSTMENT
If the student says "reduce my tasks", "I'm overwhelmed", "change 
my plan", "I can't do this much today" — call: adjust_planner()

ACTUALLY adjust the plan. Do not give emotional support without 
taking action. Take action first, then offer support.

Example:
Student: "I'm overwhelmed, reduce my tasks"
You: → call adjust_planner() → "Done. I've cut today down to 2 
hours and 3 priority topics. How are you feeling?"

RULE 9 — UPLOAD MATERIAL
If the student wants to upload notes, PDFs, textbooks — call: 
trigger_upload()

RULE 10 — ANYTHING ELSE
If the request doesn't fit any category above — just respond 
naturally like ChatGPT. You are a general assistant first. 
The engines are tools you use when relevant, not constraints 
that limit you.

You can answer general knowledge questions, help with 
motivational issues, discuss career paths, talk about exam 
strategy — anything a brilliant study partner would discuss.

════════════════════════════════════════
CRITICAL RULES — NEVER BREAK THESE
════════════════════════════════════════

NEVER say "I can only help with [subject]"
NEVER say "Please select a topic from the dropdown"
NEVER ignore a high-level request and force a micro-lesson
NEVER give emotional support WITHOUT taking a concrete action first
NEVER ask more than ONE clarifying question at a time
NEVER use bullet points for casual conversation — talk naturally
NEVER start your response with "Certainly!" or "Of course!" or 
"Great question!"
NEVER be robotic. You are a person, not a form.
NEVER lock yourself to the subject shown in any dropdown — 
that dropdown is irrelevant to you. You respond to what the 
student SAYS, not what subject is selected in the UI.

════════════════════════════════════════
RESPONSE STYLE GUIDE
════════════════════════════════════════

Casual question → 1-3 sentences max. Conversational.
Action request → Confirm action taken. Short. Direct.
Concept doubt → Acknowledge + hand to tutor engine.
Data request → Narrate the numbers like a coach, not a report.
Emotional message → Acknowledge briefly, then take one concrete 
action to help. Don't dwell.
Complex request → Ask one clarifying question, then act.
`;

  // Tools configuration
  const tools: any[] = [{
    functionDeclarations: [
      {
        name: "create_study_plan",
        description: "Creates a day-by-day study plan. Call this when user asks for a planner, schedule, timetable, or study plan.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            target_date: { type: Type.STRING, description: "The exam or test date e.g. 2026-05-26" },
            subjects: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of subjects to cover" },
            hours_per_day: { type: Type.NUMBER, description: "How many hours student can study per day" }
          },
          required: ["target_date"]
        }
      },
      {
        name: "trigger_tutor_session",
        description: "Activates the Socratic tutor for a concept. Call this when user asks to understand a concept, has a doubt, or asks 'explain X'.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            topic: { type: Type.STRING, description: "The concept or topic the student needs help with" },
            subject: { type: Type.STRING, description: "The subject this topic belongs to" }
          },
          required: ["topic"]
        }
      },
      {
        name: "show_analytics",
        description: "Shows student performance data. Call this when user asks how they are doing, wants progress statistics, or performance info.",
        parameters: { type: Type.OBJECT, properties: {} }
      },
      {
        name: "show_atlas",
        description: "Shows the knowledge graph / atlas. Call this when user asks about progress, weak areas, or knowledge map.",
        parameters: { type: Type.OBJECT, properties: {} }
      },
      {
        name: "run_autopsy",
        description: "Runs mock test analysis. Call this when user mentions a test result, mock test, or wants test analysis.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            test_id: { type: Type.STRING, description: "ID of the mock test (optional)" },
            test_name: { type: Type.STRING, description: "Name of the mock test (optional)" }
          }
        }
      },
      {
        name: "show_flashcards",
        description: "Shows flashcards or revision interface. Call this when user mentions flashcards, memory review, or revision.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            topic: { type: Type.STRING, description: "Topic to revise (optional)" }
          }
        }
      },
      {
        name: "adjust_planner",
        description: "Adjusts the student's study plan or tasks. Call this when user feels overwhelmed, wants to reduce tasks, or change plan.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            action: { type: Type.STRING, description: "Action to take e.g. reduce" },
            intensity: { type: Type.STRING, description: "Target intensity e.g. light, moderate" }
          },
          required: ["action"]
        }
      },
      {
        name: "trigger_upload",
        description: "Triggers file or material upload. Call this when user wants to upload notes, PDFs, or textbooks.",
        parameters: { type: Type.OBJECT, properties: {} }
      }
    ]
  }];

  // Construct Gemini History structure
  const geminiHistory = (history || []).slice(-8).map((m: any) => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }]
  }));

  geminiHistory.push({
    role: 'user',
    parts: [{ text: message }]
  });

  // Call central orchestrator
  let orchestratorResponse;
  try {
    orchestratorResponse = await genai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: geminiHistory,
      config: {
        systemInstruction: ORCHESTRATOR_PROMPT,
        tools: tools,
        temperature: 0.2,
        maxOutputTokens: 1024
      }
    });
  } catch (err) {
    logger.error('Orchestrator invocation failed', err);
    return new Response('Failed to contact Central Intelligence Orchestrator', { status: 500 });
  }

  const call = orchestratorResponse.functionCalls?.[0];
  const historyText = (history || []).slice(-8).map((m: any) => `${m.role === 'user' ? 'Student' : 'Tutor'}: ${m.content}`).join('\n');
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let fullResponse = '';
      let metadataPayload: any = null;

      try {
        if (call) {
          const { name, args } = call;

          if (name === 'trigger_tutor_session') {
            const topic = (args as any).topic;
            const sub = (args as any).subject || subject || 'General';

            const { data: concept } = await supabase.from('concepts')
              .select('*')
              .eq('user_id', user.id)
              .eq('subject', sub)
              .eq('chapter', topic)
              .single();

            let pastSessionsText = '';
            let weakPrereqsText = '';

            if (concept) {
              const { data: pastSessions } = await supabase.from('tutor_sessions')
                .select('summary, started_at')
                .eq('user_id', user.id)
                .eq('concept_id', concept.id)
                .not('summary', 'is', null)
                .order('started_at', { ascending: false })
                .limit(5);
              
              if (pastSessions && pastSessions.length > 0) {
                pastSessionsText = `\n\n### PAST CONVERSATIONS ON THIS TOPIC:\n` + 
                  pastSessions.map(s => `- [${new Date(s.started_at).toLocaleDateString()}] ${s.summary}`).join('\n');
              }

              try {
                const weakPrereqs = await getPrerequisiteChain(concept.id);
                if (weakPrereqs && weakPrereqs.length > 0) {
                  weakPrereqsText = `\n\n### WEAK PREREQUISITES:\n` + 
                    weakPrereqs.map(p => `- ${p.name} (Mastery: ${p.mastery})`).join('\n');
                }
              } catch (e) {
                logger.error("Failed to fetch prerequisite chain", e);
              }
            }

            const { data: mistakes } = await supabase.from('mistakes')
              .select('category, ai_analysis')
              .eq('user_id', user.id)
              .eq('subject', sub)
              .limit(5);

            let triagePromptAddendum = '';
            if (targetDate && targetDate !== 'Not set') {
              const today = new Date(current_date);
              const target = new Date(targetDate);
              const diffTime = target.getTime() - today.getTime();
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              
              if (diffDays > 0 && diffDays < 14) {
                triagePromptAddendum = `
                  \n\n[CRITICAL_TRIAGE MODE ACTIVATED]: The student has an exam in exactly ${diffDays} days (${targetDate}).
                  - BYPASS standard deep Socratic learning loops.
                  - Explain concepts directly and efficiently. Highlight high-yield exam patterns, warning traps, and fast recall tricks.
                  - Keep explanations concise to optimize time.
                `;
              }
            }

            const context = `
              Current Focus: ${sub} > ${topic}
              Student Mastery: ${concept?.mastery || 'unknown'}
              Past Mistakes Here: ${mistakes?.map((m: any) => m.ai_analysis).join(', ') || 'None'}${weakPrereqsText}${pastSessionsText}
            `;

            const fullPrompt = `${context}\n\n## Conversation\n${historyText}\n\nStudent: ${message}`;
            const tutorSystemPrompt = getTutorSystemPrompt(examType) + triagePromptAddendum;

            for await (const chunk of streamText('flash', tutorSystemPrompt, fullPrompt, 0.7)) {
              controller.enqueue(encoder.encode(chunk));
              fullResponse += chunk;
            }

            // Trigger Socratic post-session synthesis
            Promise.resolve().then(async () => {
              if (!concept) return;
              const analysisPrompt = `Analyze this tutor session. Did the student demonstrate clear understanding? Are there knowledge gaps?
              Session: ${historyText}\nStudent: ${message}\nTutor: ${fullResponse}
              Respond exactly as JSON: { "summary": "1 sentence summary", "understood": true, "gapFound": "Question to put on flashcard front", "gapAnswer": "Answer for back" }`;
              
              try {
                const analysis = await generateJSON<any>('flash', 'Expert analyzer.', analysisPrompt);
                const currentMessages = [...(history || []), { role: 'user', content: message }, { role: 'tutor', content: fullResponse }];
                
                await supabase.from('tutor_sessions').insert({ 
                  user_id: user.id, 
                  concept_id: concept.id, 
                  summary: analysis.summary,
                  messages: currentMessages
                });

                if (analysis.understood) await updateConceptState(concept.id, true, 0); 
                if (analysis.gapFound && !analysis.understood) {
                  await createSingleCard(user.id, concept.id, analysis.gapFound, analysis.gapAnswer, sub || 'General', topic || 'General');
                }
              } catch (e) { 
                logger.error("Tutor post-processing failed", e); 
              }
            });

          } else if (name === 'create_study_plan') {
            const target_date = (args as any).target_date;
            const defaultSubjects = allConcepts && allConcepts.length > 0
              ? Array.from(new Set(allConcepts.map(c => c.subject)))
              : ['Physics', 'Chemistry', 'Biology'];
            const subjects = (args as any).subjects || defaultSubjects;
            const hours_per_day = (args as any).hours_per_day || hoursPerDay;

            controller.enqueue(encoder.encode(`⚡ Ingesting telemetry...\n`));
            controller.enqueue(encoder.encode(`🔍 Analyzing current weak areas and mastery stats...\n`));
            controller.enqueue(encoder.encode(`🧠 Generating customized daily study schedule until ${target_date}...\n`));
            
            const result = await generateSprintPlanAction(
              subjects,
              target_date,
              Number(hours_per_day)
            );

            if (result.success) {
              const successMsg = `\n\nAll set! I have generated your study plan from today until ${target_date} for ${hours_per_day} hours/day covering ${subjects.join(', ')}. Your Command Center focus widgets have been synchronized.`;
              controller.enqueue(encoder.encode(successMsg));
              fullResponse = successMsg;
              metadataPayload = {
                action: 'sprint_plan_created',
                tasks: result.tasks
              };
            } else {
              const failMsg = `\n\nFailed to execute schedule plan generation: ${result.error || 'Unknown database issue'}.`;
              controller.enqueue(encoder.encode(failMsg));
              fullResponse = failMsg;
            }

          } else if (name === 'show_analytics') {
            const msg = `Opening your performance Analytics dashboard...`;
            controller.enqueue(encoder.encode(msg));
            fullResponse = msg;
            metadataPayload = { action: 'show_analytics' };

          } else if (name === 'show_atlas') {
            const msg = `Opening your ATLAS Knowledge Graph...`;
            controller.enqueue(encoder.encode(msg));
            fullResponse = msg;
            metadataPayload = { action: 'show_atlas' };

          } else if (name === 'run_autopsy') {
            const testName = (args as any).test_name || 'Mock Test';
            const msg = `Opening your Autopsy test analysis center for ${testName}...`;
            controller.enqueue(encoder.encode(msg));
            fullResponse = msg;
            metadataPayload = { action: 'run_autopsy', test_name: testName };

          } else if (name === 'show_flashcards' || name === 'generate_flashcards') {
            const topic = (args as any).topic || 'all';
            const msg = `Opening your flashcards review center...`;
            controller.enqueue(encoder.encode(msg));
            fullResponse = msg;
            metadataPayload = { action: 'generate_flashcards', topic };

          } else if (name === 'adjust_planner') {
            const actionType = (args as any).action || 'reduce';
            const intensityType = (args as any).intensity || 'light';
            let adjustMsg = `Adjusting your study tasks for today to match a ${intensityType} workload...`;

            try {
              const todayStr = new Date().toISOString().split('T')[0];
              const { data: todayTasks } = await supabase.from('study_tasks')
                .select('id, priority')
                .eq('user_id', user.id)
                .eq('scheduled_date', todayStr)
                .eq('is_completed', false);

              if (todayTasks && todayTasks.length > 0) {
                // Drop non-critical tasks
                const tasksToComplete = todayTasks.filter(t => t.priority !== 'critical' && t.priority !== 'high');
                if (tasksToComplete.length > 0) {
                  const ids = tasksToComplete.map(t => t.id);
                  await supabase.from('study_tasks').delete().in('id', ids);
                  adjustMsg += `\nDone! Dropped ${tasksToComplete.length} non-critical tasks from your checklist.`;
                } else {
                  adjustMsg += `\nAll remaining tasks are high priority or critical, but I have trimmed the intensity in your tracker.`;
                }
              } else {
                adjustMsg += `\nNo pending tasks found for today.`;
              }
            } catch (e) {
              logger.error('Failed to adjust planner', e);
              adjustMsg += `\n(Encountered database synchronization issue during adjustment)`;
            }

            controller.enqueue(encoder.encode(adjustMsg));
            fullResponse = adjustMsg;
            metadataPayload = { action: 'adjust_planner', actionType, intensityType };

          } else if (name === 'trigger_upload') {
            const msg = `Opening your materials upload interface...`;
            controller.enqueue(encoder.encode(msg));
            fullResponse = msg;
            metadataPayload = { action: 'trigger_upload' };
          }
        } else {
          // Normal conversational text from orchestrator
          const normalText = orchestratorResponse.text || 'I understand. Let me guide you to the right section or tool.';
          controller.enqueue(encoder.encode(normalText));
          fullResponse = normalText;
        }

        // Output Metadata boundary if exists
        if (metadataPayload) {
          const serializedMeta = `\n\n===METADATA===\n${JSON.stringify(metadataPayload)}`;
          controller.enqueue(encoder.encode(serializedMeta));
        }

      } catch (err: any) {
        logger.error('Stream processing error in orchestrator', err);
        controller.enqueue(encoder.encode('\n\n[System encountered an error processing your query. Context state was preserved.]'));
      }
      controller.close();
    }
  });

  return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
