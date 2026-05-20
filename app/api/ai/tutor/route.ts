// app/api/ai/tutor/route.ts
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

  // Notice: We NO LONGER extract 'subject' and 'chapter' from the request.
  // The orchestrator infers intent entirely from conversation.
  const { message, history, contextState } = await req.json();

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

  const nowIso = new Date().toISOString();
  const { count: dueCount } = await supabase.from('revision_cards')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .lte('due', nowIso);
  const dueFlashcardCount = dueCount || 0;

  const { data: lastAutopsy } = await supabase.from('mock_autopsies')
    .select('current_score, test_name')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const lastMockScore = lastAutopsy ? `${lastAutopsy.current_score} (on ${lastAutopsy.test_name})` : 'No mock tests taken yet';

  const { data: userMaterials } = await supabase.from('materials')
    .select('title')
    .eq('user_id', user.id);
  const uploadedMaterials = userMaterials && userMaterials.length > 0
    ? userMaterials.map(m => m.title).join(', ')
    : 'None';

  const current_date = new Date().toISOString().split('T')[0];

  const ORCHESTRATOR_PROMPT = `You are the central intelligence of Cognition OS — an AI operating system for students. Your name is "Cognition".

You are NOT a basic tutor locked to one subject. You are a generalized AI orchestrator.
Think of yourself exactly like ChatGPT — but you have access to the student's complete academic data and six specialized engines (ATLAS, MEMORY, AUTOPSY, PULSE, COMMAND, MIND).

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
- Conversational, warm, direct. Like a brilliant friend who happens to know everything about the student's academic life.
- Never robotic. Short responses for simple questions. 
- You remember everything about this student. If you notice a trend in their data, mention it naturally.

════════════════════════════════════════
HOW TO USE YOUR ENGINES (TOOLS)
════════════════════════════════════════
RULE 1 — GENERAL CHITCHAT: If the student says "hey", respond naturally and warmly. Pull in one relevant piece of their data (e.g. "Hey! You've got ${dueFlashcardCount} flashcards due today. What's the plan?").
RULE 2 — CONCEPT EXPLANATION: If the student asks to understand something, has a doubt, or asks "explain X", call: trigger_tutor_session(). You will seamlessly transition into the Socratic MIND engine.
RULE 3 — STUDY PLANNER: If they ask for a study plan or schedule, call: create_study_plan().
RULE 4 — FLASHCARD REVIEW: If they say "let's review" or "show me flashcards", call: show_flashcards().
RULE 5 — MOCK TEST UPLOAD: If they want to upload a test, call: run_autopsy().
RULE 6 — PLANNER ADJUSTMENT: If they say "I'm overwhelmed, reduce my tasks", call: adjust_planner(). Take concrete action before giving emotional support.

CRITICAL: NEVER lock yourself to a specific subject unless the student explicitly asks about it. You are the orchestrator.
`;

  const tools: any[] = [{
    functionDeclarations: [
      {
        name: "trigger_tutor_session",
        description: "Activates the Socratic tutor. Call this when user asks to understand a concept, has a doubt, or asks 'explain X'.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            topic: { type: Type.STRING, description: "The concept the student needs help with (e.g., 'Carnot Cycles')" },
            subject: { type: Type.STRING, description: "The broader subject (e.g., 'Physics', 'Chemistry')" }
          },
          required: ["topic"]
        }
      },
      {
        name: "create_study_plan",
        description: "Creates a day-by-day study plan.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            target_date: { type: Type.STRING, description: "The exam or test date e.g. 2026-05-26" },
            subjects: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["target_date"]
        }
      },
      {
        name: "show_analytics",
        description: "Opens performance analytics.",
        parameters: { type: Type.OBJECT, properties: {} }
      },
      {
        name: "show_atlas",
        description: "Opens the knowledge graph.",
        parameters: { type: Type.OBJECT, properties: {} }
      },
      {
        name: "run_autopsy",
        description: "Opens mock test autopsy.",
        parameters: { type: Type.OBJECT, properties: {} }
      },
      {
        name: "show_flashcards",
        description: "Starts flashcard revision.",
        parameters: { type: Type.OBJECT, properties: {} }
      },
      {
        name: "adjust_planner",
        description: "Adjusts the daily plan based on fatigue.",
        parameters: {
          type: Type.OBJECT,
          properties: { action: { type: Type.STRING } },
          required: ["action"]
        }
      },
      {
        name: "trigger_upload",
        description: "Opens material upload.",
        parameters: { type: Type.OBJECT, properties: {} }
      }
    ]
  }];

  const geminiHistory = (history || []).slice(-8).map((m: any) => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }]
  }));
  geminiHistory.push({ role: 'user', parts: [{ text: message }] });

  let orchestratorResponse;
  try {
    orchestratorResponse = await genai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: geminiHistory,
      config: {
        systemInstruction: ORCHESTRATOR_PROMPT,
        tools: tools,
        temperature: 0.2,
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
            // Best effort deduction of subject from the AI's function call arguments
            const sub = (args as any).subject || 'General';

            // Resolve concept dynamically
            const { data: concept } = await supabase.from('concepts')
              .select('*').eq('user_id', user.id).eq('subject', sub).ilike('chapter', `%${topic}%`).limit(1).maybeSingle();

            const { data: mistakes } = await supabase.from('mistakes')
              .select('category, ai_analysis').eq('user_id', user.id).eq('subject', sub).limit(5);

            let pastSessionsText = '';
            let weakPrereqsText = '';

            if (concept) {
              const { data: pastSessions } = await supabase.from('tutor_sessions')
                .select('summary, started_at').eq('user_id', user.id).eq('concept_id', concept.id)
                .not('summary', 'is', null).order('started_at', { ascending: false }).limit(3);
              
              if (pastSessions && pastSessions.length > 0) {
                pastSessionsText = `\n\n### PAST CONVERSATIONS ON THIS TOPIC:\n` + 
                  pastSessions.map(s => `- [${new Date(s.started_at).toLocaleDateString()}] ${s.summary}`).join('\n');
              }
            }

            const context = `
              Current Focus: ${sub} > ${topic}
              Student Mastery: ${concept?.mastery || 'unknown'}
              Past Mistakes Here: ${mistakes?.map((m: any) => m.ai_analysis).join(', ') || 'None'}${weakPrereqsText}${pastSessionsText}
            `;

            const fullPrompt = `${context}\n\n## Conversation\n${historyText}\n\nStudent: ${message}`;
            const tutorSystemPrompt = getTutorSystemPrompt(examType);

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
                  user_id: user.id, concept_id: concept.id, summary: analysis.summary, messages: currentMessages
                });

                if (analysis.understood) await updateConceptState(concept.id, true, 0); 
                if (analysis.gapFound && !analysis.understood) {
                  await createSingleCard(user.id, concept.id, analysis.gapFound, analysis.gapAnswer, sub, topic);
                }
              } catch (e) {}
            });

          } else if (name === 'create_study_plan') {
            const target_date = (args as any).target_date;
            controller.enqueue(encoder.encode(`⚡ Ingesting telemetry...\n🧠 Generating customized daily study schedule until ${target_date}...`));
            const result = await generateSprintPlanAction(allConcepts?.map(c => c.subject) || [], target_date, hoursPerDay);
            if (result.success) {
              const msg = `\n\nAll set! I have generated your study plan.`;
              controller.enqueue(encoder.encode(msg));
              metadataPayload = { action: 'sprint_plan_created', tasks: result.tasks };
            }
          } else if (name === 'adjust_planner') {
            const msg = `Adjusting your study tasks for today to reduce cognitive load...`;
            controller.enqueue(encoder.encode(msg));
            metadataPayload = { action: 'adjust_planner' };
          } else {
            // Routing actions
            const msg = `Taking you there right now...`;
            controller.enqueue(encoder.encode(msg));
            metadataPayload = { action: name };
          }
        } else {
          // Normal conversational text
          const normalText = orchestratorResponse.text || 'I understand. How can I help?';
          controller.enqueue(encoder.encode(normalText));
        }

        // Output Metadata boundary if exists
        if (metadataPayload) {
          controller.enqueue(encoder.encode(`\n\n===METADATA===\n${JSON.stringify(metadataPayload)}`));
        }

      } catch (err: any) {
        controller.enqueue(encoder.encode('\n\n[System error connecting to neural core.]'));
      }
      controller.close();
    }
  });

  return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
