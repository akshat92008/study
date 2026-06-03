import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import { budgetedGenerateJSON } from '@/lib/ai/budgeted';
import { ensureGoalForUser, ensureSessionGoalLink, ensureSessionBelongsToUser } from '@/lib/services/goal-context.service';

export async function POST(req: NextRequest) {
  try {
    const userClient = await createClient();
    const { data: { user }, error } = await userClient.auth.getUser();
    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { goalId, chatSessionId, question, myAnswer, correctAnswer, explanation } = body;

    if (!question || !myAnswer || !correctAnswer) {
      return NextResponse.json({ error: 'Question, your answer, and correct answer are required.' }, { status: 400 });
    }

    const supabase = userClient;

    if (goalId) await ensureGoalForUser(supabase, user.id, goalId);
    if (chatSessionId) {
      const session = await ensureSessionBelongsToUser(supabase, user.id, chatSessionId);
      if (goalId && session.goal_id !== goalId && !session.is_global) {
        await ensureSessionGoalLink(supabase, user.id, chatSessionId, goalId);
      }
    }

    // AI Classification
    const prompt = `Analyze this student mistake:
Question: ${question}
Student's Answer: ${myAnswer}
Correct Answer: ${correctAnswer}
Explanation: ${explanation || 'None'}

Return ONLY a JSON object:
{
  "category": "conceptual_gap" | "silly_error" | "time_pressure" | "misread" | "formula_recall" | "application" | "speed" | "exam_strategy" | "unknown",
  "subject": "Physics" | "Chemistry" | "Biology" | "Maths",
  "chapter": "Name of the chapter",
  "topic": "Specific topic",
  "diagnosis": "Brief 1 sentence explanation of why they got it wrong"
}`;

    const classification = await budgetedGenerateJSON<any>({
      userId: user.id,
      feature: 'autopsy',
      route: '/api/autopsy/manual',
      model: 'flash',
      systemPrompt: 'You are an expert tutor analyzing student mistakes. Return ONLY valid JSON.',
      userPrompt: prompt,
    });

    if (!classification || !classification.category) {
      throw new Error('Failed to classify mistake');
    }

    // 1. Ensure concept exists
    let conceptId: string | null = null;
    if (classification.subject && classification.chapter && classification.topic) {
      let conceptQuery = supabase
        .from('concepts')
        .select('id')
        .eq('user_id', user.id)
        .eq('subject', classification.subject)
        .eq('chapter', classification.chapter)
        .eq('topic', classification.topic);
        
      if (goalId) {
        conceptQuery = conceptQuery.eq('goal_id', goalId);
      }
      
      const { data: existingConcept } = await conceptQuery.maybeSingle();

      if (existingConcept) {
        conceptId = existingConcept.id;
      } else {
        const { data: newConcept } = await supabase
          .from('concepts')
          .insert({
            user_id: user.id,
            subject: classification.subject,
            chapter: classification.chapter,
            topic: classification.topic,
            name: classification.topic,
            mastery: 'not_started',
            ...(goalId ? { goal_id: goalId } : {}),
            ...(chatSessionId ? { chat_session_id: chatSessionId } : {})
          })
          .select('id')
          .single();
        if (newConcept) conceptId = newConcept.id;
      }
    }

    // 2. Create mock autopsy dummy row
    const { data: autopsy } = await supabase
      .from('mock_autopsies')
      .insert({
        user_id: user.id,
        test_name: 'Manual Mistake Review',
        total_marks: 4,
        marks_obtained: -1,
        marks_lost: 5,
        status: 'completed',
        completed_at: new Date().toISOString(),
        ...(goalId ? { goal_id: goalId } : {}),
        ...(chatSessionId ? { chat_session_id: chatSessionId } : {})
      })
      .select('id')
      .single();

    // 3. Create mistake row
    const { data: mistake, error: mistakeError } = await supabase
      .from('mistakes')
      .insert({
        user_id: user.id,
        autopsy_id: autopsy?.id,
        concept_id: conceptId,
        category: classification.category,
        question_text: question,
        user_answer: myAnswer,
        correct_answer: correctAnswer,
        marks_lost: 5,
        subject: classification.subject,
        chapter: classification.chapter,
        ...(goalId ? { goal_id: goalId } : {}),
        ...(chatSessionId ? { chat_session_id: chatSessionId } : {})
      })
      .select('id')
      .single();

    if (mistakeError) throw mistakeError;

    // 4. Generate revision cards using AI
    const cardsPrompt = `Generate 3 revision cards based on this mistake:
Question: ${question}
Student's Answer: ${myAnswer}
Correct Answer: ${correctAnswer}
Explanation: ${explanation || 'None'}
Diagnosis: ${classification.diagnosis}
Mistake Type: ${classification.category}

Return ONLY a JSON object with this format:
{
  "cards": [
    { "front": "...", "back": "...", "type": "mistake_concept" },
    { "front": "...", "back": "...", "type": "error_pattern" },
    { "front": "...", "back": "...", "type": "similar_trap" }
  ],
  "nextAction": "..."
}`;

    const cardsResult = await budgetedGenerateJSON<{ cards: any[], nextAction: string }>({
      userId: user.id,
      feature: 'autopsy',
      route: '/api/autopsy/manual',
      model: 'flash',
      systemPrompt: 'You are an expert tutor generating flashcards for mistake revision. Return ONLY valid JSON.',
      userPrompt: cardsPrompt,
    });

    let cardsCreated = 0;
    if (cardsResult?.cards && Array.isArray(cardsResult.cards)) {
      const cardsToInsert = cardsResult.cards.map((card) => ({
        user_id: user.id,
        concept_id: conceptId,
        front: card.front,
        back: card.back,
        card_type: 'mistake',
        state: 0, // 'new' represented by 0 integer
        due: new Date().toISOString(),
        source_type: 'manual_mistake_review',
        metadata: {
          mistakeId: mistake?.id,
          category: classification.category,
          generated_type: card.type,
          question_snippet: question.substring(0, 100),
        },
        subject: classification.subject,
        chapter: classification.chapter,
        topic: classification.topic,
        ...(goalId ? { goal_id: goalId } : {}),
        ...(chatSessionId ? { chat_session_id: chatSessionId } : {})
      }));

      const { data: insertedCards, error: cardsError } = await supabase
        .from('revision_cards')
        .insert(cardsToInsert)
        .select('id');
        
      if (!cardsError && insertedCards) {
        cardsCreated = insertedCards.length;
      } else if (cardsError) {
        logger.warn('Failed to insert revision cards for manual mistake', { error: cardsError.message });
      }
    }

    // Emit event
    let mistakeId: string | null = null;
    if (mistake) mistakeId = mistake.id;
    await supabase.from('student_events').insert({
      user_id: user.id,
      type: 'MISTAKE_LOGGED_MANUALLY',
      data: {
        mistakeId,
        goalId,
        chatSessionId,
      }
    });

    return NextResponse.json({ 
      success: true, 
      mistakeId: mistake?.id, 
      classification,
      cardsCreated,
      nextAction: cardsResult?.nextAction
    });

  } catch (error: any) {
    logger.error('Manual autopsy error', error);
    return NextResponse.json({ error: 'Unable to analyze this mistake right now. Try again in a moment.' }, { status: 500 });
  }
}
