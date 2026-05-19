import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { streamText, generateJSON } from '@/lib/ai/gemini';
import { getTutorSystemPrompt } from '@/lib/ai/prompts/tutor';
import { updateConceptState, getPrerequisiteChain } from '@/lib/engines/cognition-graph';
import { createSingleCard } from '@/lib/engines/revision-engine';
import { logger } from '@/lib/utils/logger';

import { checkUsageLimit } from '@/lib/utils/billing';

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

  const { message, subject, chapter, history } = await req.json();

  // Fetch user's specific exam type
  const { data: profile } = await supabase.from('profiles').select('exam_type').eq('id', user.id).single();
  const examType = profile?.exam_type || 'General Study';

  // Fetch Concept & Past Sessions
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
  
  const context = `
    Current Focus: ${subject} > ${chapter}
    Student Mastery: ${concept?.mastery || 'unknown'}
    Past Mistakes Here: ${mistakes?.map((m:any) => m.ai_analysis).join(', ') || 'None'}${weakPrereqsText}${pastSessionsText}
  `;

  const historyText = (history || []).slice(-8).map((m: any) => `${m.role === 'user' ? 'Student' : 'Tutor'}: ${m.content}`).join('\n');
  const fullPrompt = `${context}\n\n## Conversation\n${historyText}\n\nStudent: ${message}`;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let fullResponse = '';
      try {
        // Pass dynamic examType to prompt
        for await (const chunk of streamText('flash', getTutorSystemPrompt(examType), fullPrompt, 0.7)) {
          controller.enqueue(encoder.encode(chunk));
          fullResponse += chunk;
        }

        Promise.resolve().then(async () => {
          if (!concept) return;
          const analysisPrompt = `Analyze this tutor session. Did the student demonstrate clear understanding? Are there knowledge gaps?
          Session: ${historyText}\nStudent: ${message}\nTutor: ${fullResponse}
          Respond exactly as JSON: { "summary": "1 sentence summary", "understood": true, "gapFound": "Question to put on flashcard front", "gapAnswer": "Answer for back" }`;
          
          try {
            const analysis = await generateJSON<any>('flash', 'Expert analyzer.', analysisPrompt);
            const currentMessages = [...(history || []), { role: 'user', content: message }, { role: 'tutor', content: fullResponse }];
            const { data: newSession } = await supabase.from('tutor_sessions').insert({ 
              user_id: user.id, 
              concept_id: concept.id, 
              summary: analysis.summary,
              messages: currentMessages
            }).select('id').single();

            // Trigger student model sync after every 10th tutor session
            const { count } = await supabase.from('tutor_sessions')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id);
            
            if (count && count % 10 === 0) {
              const { syncStudentModel } = await import('@/lib/engines/inference-engine');
              await syncStudentModel(user.id);
              logger.info(`Student model synced on session count ${count}`);
            }

            if (analysis.understood) await updateConceptState(concept.id, true, 0); 
            if (analysis.gapFound && !analysis.understood) {
              await createSingleCard(user.id, concept.id, analysis.gapFound, analysis.gapAnswer, subject || 'General', chapter || 'General');
            }
          } catch (e) { logger.error("Tutor post-processing failed", e); }
        });

      } catch { controller.enqueue(encoder.encode('\n\n[System Error processing request.]')); }
      controller.close();
    },
  });

  return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
