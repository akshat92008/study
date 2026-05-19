import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { streamText, generateJSON } from '@/lib/ai/gemini';
import { getTutorSystemPrompt } from '@/lib/ai/prompts/tutor';
import { updateConceptState, getPrerequisiteChain } from '@/lib/engines/cognition-graph';
import { createSingleCard } from '@/lib/engines/revision-engine';
import { logger } from '@/lib/utils/logger';
import { checkUsageLimit } from '@/lib/utils/billing';
import { generateSprintPlanAction } from '@/lib/actions/planner';
import { z } from 'zod';

const ClassifierOutputSchema = z.object({
  intent: z.enum(['ADMIN_PLANNING', 'CONCEPTUAL_DOUBT', 'SYSTEM_QUERY', 'OFF_TOPIC']),
  extracted_entities: z.object({
    target_date: z.string().nullable(),
    subjects: z.array(z.string()).nullable(),
    hours: z.number().nullable(),
  }),
});

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

  // Fetch user's specific exam type
  const { data: profile } = await supabase.from('profiles').select('exam_type').eq('id', user.id).single();
  const examType = profile?.exam_type || 'General Study';

  const current_date = new Date().toISOString().split('T')[0];

  // 1. Classifier Node (Intent & Entity Extraction)
  let classification;
  try {
    const classifierSystemPrompt = `
      You are the intent classification module of Cognition OS.
      Analyze the student's message and the conversation history to classify the intent and extract scheduling parameters.
      
      Intents:
      - ADMIN_PLANNING: The student is talking about planning, setting deadlines, schedules, daily hours, calendar dates, or organizing study blocks.
      - CONCEPTUAL_DOUBT: The student is asking about academic concepts, equations, homework, formulas, or study material content.
      - SYSTEM_QUERY: The student is asking about their revision count, stats, subscription status, or system controls.
      - OFF_TOPIC: Chit-chat, greetings (hello, hi), or comments that don't belong in the other categories.

      Parameters to extract (only if explicitly mentioned in the message or recent history):
      - target_date: YYYY-MM-DD format. If they mention a date like "May 28th", assume the year 2026 (e.g. 2026-05-28).
      - subjects: Array of strings (e.g. ["Physics", "Chemistry", "Biology"]).
      - hours: Number of daily study hours.

      Current date is: ${current_date}
    `;

    const historyTextForClassifier = (history || []).slice(-4).map((m: any) => `${m.role === 'user' ? 'Student' : 'Tutor'}: ${m.content}`).join('\n');
    const classifierUserPrompt = `History:\n${historyTextForClassifier}\n\nLatest message: "${message}"`;

    classification = await generateJSON(
      'flash',
      classifierSystemPrompt,
      classifierUserPrompt,
      ClassifierOutputSchema
    );
  } catch (err) {
    logger.error('Classifier Node failed, fallback to CONCEPTUAL_DOUBT', err);
    classification = {
      intent: 'CONCEPTUAL_DOUBT',
      extracted_entities: { target_date: null, subjects: null, hours: null }
    };
  }

  // Merge context states
  const mergedState = {
    target_date: classification.extracted_entities.target_date || contextState?.target_date || null,
    subjects: classification.extracted_entities.subjects || contextState?.subjects || null,
    hours: classification.extracted_entities.hours || contextState?.hours || null,
  };

  const historyText = (history || []).slice(-8).map((m: any) => `${m.role === 'user' ? 'Student' : 'Tutor'}: ${m.content}`).join('\n');

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let fullResponse = '';
      let metadataPayload: any = null;

      try {
        // --- ROUTING ENGINE ---
        if (classification.intent === 'ADMIN_PLANNING') {
          const hasAllParams = mergedState.target_date && mergedState.subjects && mergedState.subjects.length > 0 && mergedState.hours;

          if (hasAllParams) {
            // TOOL CALL: Mutate Database
            controller.enqueue(encoder.encode(`⚡ Creating hyper-sprint plan... Mutating backend states in database.`));
            const result = await generateSprintPlanAction(
              mergedState.subjects!,
              mergedState.target_date!,
              Number(mergedState.hours!)
            );

            if (result.success) {
              const successMsg = `\n\nAll set! I have generated your hyper-sprint plan from today until ${mergedState.target_date} for ${mergedState.hours} hours/day covering ${mergedState.subjects?.join(', ')}. Your Command Center focus widgets have been synchronized.`;
              controller.enqueue(encoder.encode(successMsg));
              fullResponse = successMsg;
              metadataPayload = {
                action: 'sprint_plan_created',
                tasks: result.tasks,
                contextState: mergedState
              };
            } else {
              const failMsg = `\n\nFailed to execute schedule mutation: ${result.error || 'Unknown database issue'}.`;
              controller.enqueue(encoder.encode(failMsg));
              fullResponse = failMsg;
            }
          } else {
            // Planner Agent prompt asking for missing parameters
            const plannerPrompt = `
              You are the Study Planner Agent in Cognition OS.
              Your sole job is to set up study schedules and sprints. You are NOT a tutor. Do NOT explain concepts.
              
              Current parameters gathered:
              - Target Date: ${mergedState.target_date || 'Missing'}
              - Subjects: ${mergedState.subjects ? mergedState.subjects.join(', ') : 'Missing'}
              - Daily Hours: ${mergedState.hours || 'Missing'}

              Identify what parameters are missing, and ask the student specifically for them in a professional, direct manner.
            `;

            for await (const chunk of streamText('flash', plannerPrompt, `Latest request: ${message}`)) {
              controller.enqueue(encoder.encode(chunk));
              fullResponse += chunk;
            }

            metadataPayload = {
              action: 'update_context',
              contextState: mergedState
            };
          }

        } else if (classification.intent === 'CONCEPTUAL_DOUBT') {
          // Tutor Agent
          const { data: concept } = await supabase.from('concepts').select('*').eq('user_id', user.id).eq('subject', subject).eq('chapter', chapter).single();

          let pastSessionsText = '';
          let weakPrereqsText = '';
          if (concept) {
            const { data: pastSessions } = await supabase.from('tutor_sessions')
              .select('summary, started_at').eq('user_id', user.id).eq('concept_id', concept.id)
              .not('summary', 'is', null).order('started_at', { ascending: false }).limit(5);
            
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

          const { data: mistakes } = await supabase.from('mistakes').select('category, ai_analysis').eq('user_id', user.id).eq('subject', subject).limit(5);
          
          let triagePromptAddendum = '';
          if (mergedState.target_date) {
            const today = new Date(current_date);
            const target = new Date(mergedState.target_date);
            const diffTime = target.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays > 0 && diffDays < 14) {
              triagePromptAddendum = `
                \n\n[CRITICAL_TRIAGE MODE ACTIVATED]: The student has an exam in exactly ${diffDays} days (${mergedState.target_date}).
                - BYPASS standard deep Socratic learning loops.
                - Explain concepts directly and efficiently. Highlight high-yield exam patterns, warning traps, and fast recall tricks.
                - Keep explanations concise to optimize time.
              `;
            }
          }

          const context = `
            Current Focus: ${subject} > ${chapter}
            Student Mastery: ${concept?.mastery || 'unknown'}
            Past Mistakes Here: ${mistakes?.map((m:any) => m.ai_analysis).join(', ') || 'None'}${weakPrereqsText}${pastSessionsText}
          `;

          const fullPrompt = `${context}\n\n## Conversation\n${historyText}\n\nStudent: ${message}`;
          const tutorSystemPrompt = getTutorSystemPrompt(examType) + triagePromptAddendum;

          for await (const chunk of streamText('flash', tutorSystemPrompt, fullPrompt, 0.7)) {
            controller.enqueue(encoder.encode(chunk));
            fullResponse += chunk;
          }

          // Trigger background post-processing tasks asynchronously
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
                await createSingleCard(user.id, concept.id, analysis.gapFound, analysis.gapAnswer, subject || 'General', chapter || 'General');
              }
            } catch (e) { 
              logger.error("Tutor post-processing failed", e); 
            }
          });

        } else {
          // Off topic / System queries general conversational node
          const systemMsg = `You are Cognition OS assistant. Keep greetings friendly and short. Guide the user back to studying if they are off-topic.`;
          for await (const chunk of streamText('flash', systemMsg, message)) {
            controller.enqueue(encoder.encode(chunk));
            fullResponse += chunk;
          }
        }

        // Output Metadata boundary if exists
        if (metadataPayload) {
          const serializedMeta = `\n\n===METADATA===\n${JSON.stringify(metadataPayload)}`;
          controller.enqueue(encoder.encode(serializedMeta));
        }

      } catch (err: any) {
        logger.error('Stream processing encountered error', err);
        controller.enqueue(encoder.encode('\n\n[System encountered an error processing your query. Context state was preserved.]'));
      }
      controller.close();
    },
  });

  return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
