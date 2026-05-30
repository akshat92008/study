// app/api/ai/welcome/route.ts
// Generates a personalized opening message for each student session.
// Called once when the chat mounts and no prior conversation exists.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getMINDContext } from '@/lib/engines/mind-engine';
import { routeTextGeneration } from '@/lib/ai/router';
import { logger } from '@/lib/utils/logger';
import { reserveBudgetForModelCall } from '@/lib/ai/cost-guard';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ message: null }, { status: 401 });

    const ctx = await getMINDContext(user.id);

    const daysToExam = ctx.profile.examDate
      ? Math.ceil((new Date(ctx.profile.examDate).getTime() - Date.now()) / 86400000)
      : null;

    // Check if this is a returning user with meaningful history
    const { count: sessionCount } = await supabase
      .from('study_sessions').select('*', { count: 'exact', head: true }).eq('user_id', user.id);

    const isFirstTime = !sessionCount || sessionCount === 0;

    if (isFirstTime) {
      // First time — just be direct and warm
      const name = ctx.profile.name !== 'Student' ? ctx.profile.name.split(' ')[0] : null;
      const greeting = name ? `Hey ${name}.` : 'Hey.';
      const examLine = ctx.profile.examType && ctx.profile.examType !== 'General'
        ? ` You're studying ${ctx.profile.examType}.`
        : '';
      const dateLine = daysToExam ? ` ${daysToExam} days to your target.` : '';
      return NextResponse.json({
        message: `${greeting}${examLine}${dateLine} Tell me what you want to learn today, send me a question, or upload something to work through. I'm here.`,
        isFirstTime: true,
      });
    }

    // Returning user — build data-driven greeting
    let reservation;
    try {
      reservation = await reserveBudgetForModelCall(user.id, 'welcome', 'fast', 250, 100);
    } catch (err) {
      return NextResponse.json({
        message: `Hey — ${ctx.overdueCards > 0 ? `${ctx.overdueCards} cards are overdue.` : 'ready when you are.'}`,
        isFirstTime: false,
        streakDays: ctx.profile.streakDays,
        overdueCards: ctx.overdueCards,
        masteryPercent: ctx.masteryStats.masteryPercent,
      });
    }

    const prompt = `You are Cognition OS, a senior who knows this student completely.
Write a ONE sentence opening message for when they open the app today.

Student: ${ctx.profile.name}
Exam: ${ctx.profile.examType}
Days to exam: ${daysToExam || 'Not set'}
Active streak: ${ctx.profile.streakDays} days
Overdue flashcards: ${ctx.overdueCards}
Mastery: ${ctx.masteryStats.masteryPercent}%
Weak areas: ${ctx.weakConcepts.slice(0, 3).map(c => c.name).join(', ') || 'None identified yet'}
Emotional state: ${ctx.emotionalState}
Recent topics: ${ctx.recentTopics.slice(0, 2).join(', ') || 'None'}

Rules:
- Maximum 1-2 sentences. Direct. Warm. Personal.
- Reference ONE specific real data point (streak, overdue cards, days, a weak concept name).
- If overdue cards > 0, mention them. If streak > 7, acknowledge it.
- Never say "Great to see you" or "Welcome back". Just start with what matters.
- If days to exam < 10, be urgent. If emotional state is struggling, be gentle first.
- End with an implicit invitation to act — not a question.

Examples of good messages:
- "73 days left and 5 cards are overdue today — let's clear the queue first."  
- "Your streak is at 12 days. Electrochemistry is the gap standing between you and your target score."
- "You've covered 61% of your syllabus. Thermodynamics needs attention before the mock next week."

Return ONLY the message. No explanation. No quotes around it.`;

    const message = await routeTextGeneration('chat', 'You are a concise, warm AI tutor. Respond with a single sentence.', prompt, 0.8, 150, reservation.reservationId);

    return NextResponse.json({
      message: message?.trim() || `Hey — ${ctx.overdueCards > 0 ? `${ctx.overdueCards} cards are overdue.` : 'ready when you are.'}`,
      isFirstTime: false,
      streakDays: ctx.profile.streakDays,
      overdueCards: ctx.overdueCards,
      masteryPercent: ctx.masteryStats.masteryPercent,
    });

  } catch (err) {
    logger.error('Welcome message generation failed', err);
    return NextResponse.json({ message: 'Ready when you are.' });
  }
}
