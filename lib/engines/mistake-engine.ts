import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { generateJSON } from '@/lib/ai/provider-client';

const AnalyzeMistakeSchema = z.object({ rootCause: z.string(), knowledgeGap: z.string(), remediation: z.string(), prevention: z.string() });
const MarkLossReportSchema = z.object({ biggestLeak: z.string(), recoveryPlan: z.array(z.string()), estimatedImprovement: z.number(), overallAssessment: z.string() });

export async function getMistakeAnalytics(userId: string) {
  const supabase = await createClient();

  const { data: mistakes } = await supabase.from('mistakes').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  const { data: profile } = await supabase.from('profiles').select('exam_type').eq('id', userId).single();
  const examType = profile?.exam_type || 'General';

  if (!mistakes || mistakes.length === 0) return { mistakes: [], patterns: [], totalMarksLost: 0, insights: null, examType };

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
    category, count: data.count, marksLost: data.marksLost, subjects: Array.from(data.subjects),
  })).sort((a, b) => b.marksLost - a.marksLost);

  return { mistakes, patterns: patternArray, totalMarksLost, examType };
}

export async function analyzeMistake(mistake: any) {
  const questionText = mistake.questionText || 'Not provided';
  const userAnswer = mistake.userAnswer || 'Not provided';
  const correctAnswer = mistake.correctAnswer || 'Not provided';
  const marksLost = mistake.marksLost || 0;

  const prompt = `Analyze this exam mistake deeply:
Subject: ${mistake.subject}
Chapter: ${mistake.chapter}
Category: ${mistake.category}
Question: ${questionText}
Student Answer: ${userAnswer}
Correct Answer: ${correctAnswer}
Marks Lost: ${marksLost}

Respond as JSON: { "rootCause": "...", "knowledgeGap": "...", "remediation": "...", "prevention": "..." }`;

  return generateJSON('flash', `You are an expert exam analyst and cognitive psychologist.`, prompt, AnalyzeMistakeSchema);
}

export async function generateMarkLossReport(userId: string) {
  const { mistakes, patterns, totalMarksLost } = await getMistakeAnalytics(userId);
  if (mistakes.length === 0) return null;

  const supabase = await createClient();
  const { data: profile } = await supabase.from('profiles').select('exam_type, target_score').eq('id', userId).single();
  const examType = profile?.exam_type || 'General';

  const prompt = `Generate a comprehensive mark-loss report for this ${examType} student:
Total Mistakes: ${mistakes.length} | Total Marks Lost: ${totalMarksLost}

Top patterns: ${patterns.slice(0, 5).map(p => `- ${p.category}: ${p.count} times, -${p.marksLost} marks`).join('\n')}

Respond as JSON: { "biggestLeak": "...", "recoveryPlan": ["step 1", "step 2"], "estimatedImprovement": number, "overallAssessment": "summary" }`;

  return generateJSON('pro', `You are an elite ${examType} exam strategist.`, prompt, MarkLossReportSchema);
}
