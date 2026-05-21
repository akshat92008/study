import { createClient } from '@/lib/supabase/server';

export async function getPerformanceData(userId: string) {
  const supabase = await createClient();

  const [mockTestsRes, snapshotsRes, conceptsRes, mistakesRes, tasksRes, profileRes, sessionsRes] = await Promise.all([
    supabase.from('mock_tests').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
    supabase.from('performance_snapshots').select('*').eq('user_id', userId).order('date', { ascending: true }).limit(30),
    supabase.from('concepts').select('subject, mastery').eq('user_id', userId),
    supabase.from('mistakes').select('subject, category, marks_lost').eq('user_id', userId),
    supabase.from('study_tasks').select('is_completed, estimated_minutes, scheduled_date').eq('user_id', userId),
    supabase.from('profiles').select('exam_type').eq('id', userId).single(),
    supabase.from('study_sessions').select('started_at, duration_minutes, focus_score').eq('user_id', userId),
  ]);

  const mockTests = mockTestsRes.data || [];
  const snapshots = snapshotsRes.data || [];
  const concepts = conceptsRes.data || [];
  const mistakes = mistakesRes.data || [];
  const tasks = tasksRes.data || [];
  const sessions = sessionsRes.data || [];
  const examType = profileRes.data?.exam_type || 'General';

  // Score trend (from mock tests)
  const scoreTrend = mockTests.map((t: any) => ({
    name: t.test_name,
    score: t.marks_obtained,
    total: t.total_marks,
    accuracy: t.correct && t.attempted ? Math.round((t.correct / t.attempted) * 100) : 0,
    date: t.created_at,
  }));

  // Get unique subjects from actual user data (exam-agnostic)
  const uniqueSubjects = [...new Set(concepts.map(c => c.subject))];
  const masteryValues: Record<string, number> = {
    not_started: 0, exposed: 15, developing: 40, proficient: 70, mastered: 90, automated: 98,
  };
  const subjectMastery = uniqueSubjects.map(sub => {
    const subConcepts = concepts.filter(c => c.subject === sub);
    const avg = subConcepts.length > 0
      ? Math.round(subConcepts.reduce((s, c) => s + (masteryValues[c.mastery] || 0), 0) / subConcepts.length)
      : 0;
    return { subject: sub, mastery: avg };
  });

  // Mistake distribution
  const mistakeDistribution: Record<string, number> = {};
  mistakes.forEach((m: any) => {
    mistakeDistribution[m.category] = (mistakeDistribution[m.category] || 0) + 1;
  });

  // Task completion rate
  const completedTasks = tasks.filter(t => t.is_completed).length;
  const taskCompletionRate = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

  // Predicted score (simple linear regression on mock scores)
  let predictedScore = null;
  if (scoreTrend.length >= 2) {
    const lastTwo = scoreTrend.slice(-2);
    const trend = lastTwo[1].score - lastTwo[0].score;
    const maxMarks = lastTwo[1].total || 100;
    predictedScore = Math.min(maxMarks, Math.max(0, lastTwo[1].score + trend));
  }

  // Overall stats
  const totalStudyMinutes = tasks.filter(t => t.is_completed).reduce((s, t) => s + (t.estimated_minutes || 0), 0);
  const maxMarks = scoreTrend.length > 0 ? scoreTrend[scoreTrend.length - 1].total : null;

  // Peak Hours Analysis
  const hourBuckets = { Morning: 0, Afternoon: 0, Evening: 0, Night: 0 };
  sessions.forEach((s: any) => {
    if (!s.started_at) return;
    const hour = new Date(s.started_at).getHours();
    if (hour >= 5 && hour < 12) hourBuckets.Morning += s.duration_minutes || 0;
    else if (hour >= 12 && hour < 17) hourBuckets.Afternoon += s.duration_minutes || 0;
    else if (hour >= 17 && hour < 21) hourBuckets.Evening += s.duration_minutes || 0;
    else hourBuckets.Night += s.duration_minutes || 0;
  });
  
  let peakHours = 'Not enough data';
  let maxDur = 0;
  for (const [period, dur] of Object.entries(hourBuckets)) {
    if (dur > maxDur) {
      maxDur = dur;
      peakHours = period;
    }
  }

  // Productivity Score (0-100)
  const avgFocusScore = snapshots.length > 0 ? snapshots.reduce((s: any, snap: any) => s + (snap.focus_score || 0), 0) / snapshots.length : 0.5;
  const avgAcc = snapshots.length > 0 ? snapshots.reduce((s: any, snap: any) => s + (snap.accuracy || 0), 0) / snapshots.length : 0.5;
  const productivityScore = Math.round((avgFocusScore * 40) + (avgAcc * 20) + (taskCompletionRate * 0.4));

  return {
    scoreTrend,
    subjectMastery,
    mistakeDistribution,
    taskCompletionRate,
    predictedScore,
    totalStudyHours: Math.round(totalStudyMinutes / 60),
    totalMockTests: mockTests.length,
    totalMistakes: mistakes.length,
    totalMarksLost: mistakes.reduce((s, m) => s + (m.marks_lost || 0), 0),
    latestScore: scoreTrend.length > 0 ? scoreTrend[scoreTrend.length - 1].score : null,
    maxMarks,
    examType,
    peakHours,
    productivityScore,
  };
}
