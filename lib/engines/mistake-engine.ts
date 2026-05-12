import { createClient } from '@/lib/supabase/server';
import { generateJSON } from '@/lib/ai/gemini';

export async function getMistakeAnalytics(userId: string) {
  const supabase = await createClient();

  const { data: mistakes } = await supabase
    .from('mistakes')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  const { data: profile } = await supabase.from('profiles').select('exam_type').eq('id', userId).single();
  const examType = profile?.exam_type || 'General';

  if (!mistakes || mistakes.length === 0) return { mistakes: [], patterns: [], totalMarksLost: 0, insights: null, examType };

  // Aggregate patterns by category
  const patterns: Record<string, { count: number; marksLost: number; subjects: Set<string> }> = {};
  let totalMarksLost = 0;

  mistakes.forEach((m: any) => {
    totalMarksLost += m.marks_lost || 0;
    if (!patterns[m.category]) patterns[m.category] = { count: 0, marksLost: 0, subjects: new Set() };
    patterns[m.category].count++;
    patterns[m.category].marksLost += m.marks_lost || 0;
    patterns[m.category].subjects.add(m.subject);
  });

  const patternArray = Object.entries(patterns).map(([category, data]) => ({
    category,
    count: data.count,
    marksLost: data.marksLost,
    subjects: Array.from(data.subjects),
  })).sort((a, b) => b.marksLost - a.marksLost);

  return { mistakes, patterns: patternArray, totalMarksLost, examType };
}

// AI-powered deep analysis of a single mistake
export async function analyzeMistake(mistake: any) {
  const prompt = `Analyze this exam mistake deeply:

Subject: ${mistake.subject}
Chapter: ${mistake.chapter}
Category: ${mistake.category}
Question: ${mistake.question_text || 'Not provided'}
Student Answer: ${mistake.user_answer || 'Not provided'}
Correct Answer: ${mistake.correct_answer || 'Not provided'}
Marks Lost: ${mistake.marks_lost}

Provide:
1. Root cause analysis (WHY the student made this mistake)
2. The specific knowledge gap or cognitive bias involved
3. A concrete remediation strategy (what to study/practice)
4. A preventive technique for future exams

Respond as JSON:
{
  "rootCause": "...",
  "knowledgeGap": "...",
  "remediation": "...",
  "prevention": "..."
}`;

  return generateJSON('flash', 'You are an expert exam analyst and cognitive psychologist.', prompt);
}

// Generate comprehensive mark-loss report
export async function generateMarkLossReport(userId: string) {
  const { mistakes, patterns, totalMarksLost } = await getMistakeAnalytics(userId);
  if (mistakes.length === 0) return null;

  const supabase = await createClient();
  const { data: profile } = await supabase.from('profiles').select('exam_type, target_score').eq('id', userId).single();
  const examType = profile?.exam_type || 'General';

  const prompt = `Generate a comprehensive mark-loss report for this ${examType} student:

Total Mistakes: ${mistakes.length}
Total Marks Lost: ${totalMarksLost}
Target Score: ${profile?.target_score || 'Not set'}

Top mistake patterns:
${patterns.slice(0, 5).map(p => `- ${p.category}: ${p.count} times, -${p.marksLost} marks (in ${p.subjects.join(', ')})`).join('\n')}

Recent mistakes:
${mistakes.slice(0, 5).map((m: any) => `- ${m.subject}/${m.chapter}: ${m.category} (-${m.marks_lost})`).join('\n')}

Provide a brutally honest, data-driven analysis with:
1. The single biggest leak (where most marks are being lost)
2. A prioritized recovery plan
3. Estimated score improvement if fixed

Respond as JSON:
{
  "biggestLeak": "...",
  "recoveryPlan": ["step 1", "step 2", "step 3"],
  "estimatedImprovement": number,
  "overallAssessment": "2-3 sentence summary"
}`;

  return generateJSON('pro', `You are an elite ${examType} exam strategist who gives brutally honest, data-driven advice.`, prompt);
}
