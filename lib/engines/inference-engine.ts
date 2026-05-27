import { createClient } from '@/lib/supabase/server';
import { generateJSON } from '@/lib/ai/gemini';
import { logger } from '@/lib/utils/logger';

export async function syncStudentModel(userId: string, isInitialFingerprint: boolean = false) {
  const supabase = await createClient();

  // FIX FAILURE 7: Previously queried 'mentor_chats' and 'mock_tests' — both legacy
  // empty tables from old schema. Now queries the real active tables:
  // chat_messages (actual conversations) and mock_autopsies (actual test data)
  const [modelRes, mistakesRes, chatHistoryRes, autopsiesRes] = await Promise.all([
    supabase.from('student_models').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('mistakes').select('category, ai_analysis, chapter, subject')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase.from('chat_messages').select('role, content')
      .eq('user_id', userId)
      .eq('role', 'user')  // only student messages, not AI responses
      .order('created_at', { ascending: false })
      .limit(20),
    supabase.from('mock_autopsies').select('current_score, potential_score, recoverable_marks, exam_type, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const currentModel = modelRes.data || {};

  // Summarise autopsy performance
  const autopsySummary = (autopsiesRes.data || []).map(a => ({
    score: a.current_score,
    potential: a.potential_score,
    recoverable: a.recoverable_marks,
    examType: a.exam_type,
    date: a.created_at,
  }));

  // Summarise recent student chat messages (what topics they ask about, how they phrase confusion)
  const chatSample = (chatHistoryRes.data || []).map(m => m.content.slice(0, 200)).join('\n');

  const promptContext = isInitialFingerprint 
    ? `This is the initial profiling phase (first 3 sessions). Focus aggressively on how the student asks questions and structures their thoughts to detect their core learning style (Visual, Auditory, Read/Write, Kinesthetic/Active).`
    : `Read their recent data and update their psychological profile.`;

  const prompt = `You are a cognitive psychologist profiling a student. ${promptContext}

CURRENT PROFILE:
Learning Style: ${currentModel.learning_style || 'Unknown'}
Strengths: ${currentModel.strengths?.join(', ') || 'Unknown'}
Chronic Weaknesses: ${currentModel.chronic_weaknesses?.join(', ') || 'Unknown'}
Behavioral Traps: ${currentModel.behavioral_traps?.join(', ') || 'Unknown'}

RECENT DATA:
Mistake Patterns: ${JSON.stringify(mistakesRes.data || [])}
Recent Student Questions (last 20 messages): ${chatSample || 'None yet'}
Recent Mock Test Performance: ${JSON.stringify(autopsySummary)}

Based on this new data, update their profile. Be highly specific.
Respond EXACTLY in this JSON format:
{
  "learning_style": "How they learn best (1 sentence)",
  "strengths": ["array of 3 specific strengths"],
  "chronic_weaknesses": ["array of 3 deep conceptual weaknesses"],
  "behavioral_traps": ["array of 2 psychological traps, e.g. rushing, anxiety"]
}`;

  try {
    const newProfile = await generateJSON<any>('pro', 'You are an elite behavioral analyst.', prompt);

    if (newProfile) {
      await supabase.from('student_models').upsert({
        user_id: userId,
        learning_style: newProfile.learning_style,
        strengths: newProfile.strengths,
        chronic_weaknesses: newProfile.chronic_weaknesses,
        behavioral_traps: newProfile.behavioral_traps,
        last_updated: new Date().toISOString(),
      });
    }

    return newProfile;
  } catch (err) {
    logger.error('syncStudentModel failed', err);
    return null;
  }
}
