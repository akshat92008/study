import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const AnalyzeMistakeSchema = z.object({ rootCause: z.string(), knowledgeGap: z.string(), remediation: z.string(), prevention: z.string() });
const MarkLossReportSchema = z.object({ biggestLeak: z.string(), recoveryPlan: z.array(z.string()), estimatedImprovement: z.number(), overallAssessment: z.string() });

export async function getMistakeAnalytics(userId: string, goalId?: string | null) {
  const supabase = await createClient();

  let mistakesQuery = supabase
    .from('mistakes')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (goalId) mistakesQuery = mistakesQuery.eq('goal_id', goalId);
  const { data: mistakes } = await mistakesQuery;
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

import { budgetedGenerateJSON } from '@/lib/ai/budgeted';

export async function analyzeMistake(userId: string, mistake: any) {
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

  return budgetedGenerateJSON({
    userId,
    feature: 'autopsy',
    route: 'autopsy:mistake-analysis',
    model: 'flash',
    systemPrompt: `You are an expert exam analyst and cognitive psychologist.`,
    userPrompt: prompt,
    schema: AnalyzeMistakeSchema,
    maxOutputTokens: 1000
  });
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

  return budgetedGenerateJSON({
    userId,
    feature: 'autopsy',
    route: 'autopsy:mark-loss-report',
    model: 'pro',
    systemPrompt: `You are an elite ${examType} exam strategist.`,
    userPrompt: prompt,
    schema: MarkLossReportSchema,
    maxOutputTokens: 1500
  });
}
