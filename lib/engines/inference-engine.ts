import { createClient } from '@/lib/supabase/server';
import { generateJSON } from '@/lib/ai/gemini';

export async function syncStudentModel(userId: string) {
  const supabase = await createClient();

  // Fetch all recent data
  const [modelRes, mistakesRes, mentorRes, testsRes] = await Promise.all([
    supabase.from('student_models').select('*').eq('user_id', userId).single(),
    supabase.from('mistakes').select('category, ai_analysis').eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
    supabase.from('mentor_chats').select('role, content').eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
    supabase.from('mock_tests').select('marks_obtained, total_marks, negative_marks').eq('user_id', userId).order('created_at', { ascending: false }).limit(5),
  ]);

  const currentModel = modelRes.data || {};

  const prompt = `You are a cognitive psychologist profiling a student. Read their recent data and update their psychological profile.

CURRENT PROFILE:
Learning Style: ${currentModel.learning_style || 'Unknown'}
Strengths: ${currentModel.strengths?.join(', ') || 'Unknown'}
Chronic Weaknesses: ${currentModel.chronic_weaknesses?.join(', ') || 'Unknown'}
Behavioral Traps: ${currentModel.behavioral_traps?.join(', ') || 'Unknown'}

RECENT DATA:
Mistake Patterns: ${JSON.stringify(mistakesRes.data)}
Recent Chats: ${JSON.stringify(mentorRes.data)}
Recent Tests: ${JSON.stringify(testsRes.data)}

Based on this new data, update their profile. Be highly specific. 
Respond EXACTLY in this JSON format:
{
  "learning_style": "How they learn best (1 sentence)",
  "strengths": ["array of 3 specific strengths"],
  "chronic_weaknesses": ["array of 3 deep conceptual weaknesses"],
  "behavioral_traps": ["array of 2 psychological traps, e.g. rushing, anxiety"]
}`;

  const newProfile = await generateJSON<any>('pro', 'You are an elite behavioral analyst.', prompt);

  if (newProfile) {
    await supabase.from('student_models').upsert({
      user_id: userId,
      learning_style: newProfile.learning_style,
      strengths: newProfile.strengths,
      chronic_weaknesses: newProfile.chronic_weaknesses,
      behavioral_traps: newProfile.behavioral_traps,
      last_updated: new Date().toISOString()
    });
  }

  return newProfile;
}
