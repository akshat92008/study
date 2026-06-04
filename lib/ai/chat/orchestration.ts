import { budgetedGenerateJSON } from '@/lib/ai/budgeted';
import { ensureCommandPlanForDate, formatWeakAreasForChat, formatRevisionQueueForChat, localDateAfter } from '@/lib/services/command-plan.service';
import { DailyMicrotaskService } from '@/lib/services/daily-microtask.service';

export async function buildChatFirstEngineResponse(input: {
  userId: string;
  message: string;
  intent: string;
  orchestratorIntent: string;
  mindContext: any;
  supabase: any;
  goalId?: string | null;
}): Promise<{ text: string; metadata: Record<string, any> } | null> {
  const normalized = input.message.toLowerCase();
  
  let policyIntent: 'direct_generation' | 'memory_query' | 'atlas_query' | 'planning_query' | 'autopsy_query' | 'normal_chat' = 'normal_chat';

  if (
    /\b(generate|make|create|give me|prepare|build)\b/i.test(normalized) ||
    /\b(mcq|mcqs|quiz|practice questions|practice test|test me)\b/i.test(normalized) ||
    /\b(flashcard|flashcards|active recall cards|anki cards)\b/i.test(normalized) ||
    /\b(formula sheet|formula list|cheat sheet|revision sheet|quick revision|rapid revision)\b/i.test(normalized) ||
    /\b(notes|study guide|learning document|study material|teach me|explain|revise)\b/i.test(normalized)
  ) {
    policyIntent = 'direct_generation';
  } else if (/\b(what is due|show my due|show due|what should i revise from memory|due revision|due cards|memory queue|open memory|my saved revision cards)\b/i.test(normalized) || 
      (input.intent === 'FLASHCARDS' && !/\b(generate|make|create|give me|practice|revise|flashcard for|flashcards for)\b/i.test(normalized))) {
    policyIntent = 'memory_query';
  } else if (/\b(weakest areas|weak areas|weak chapters|where am i weak|what am i weak|what is my mastery|what should i improve|progress|mastery)\b/i.test(normalized) || 
      input.intent === 'ATLAS') {
    policyIntent = 'atlas_query';
  } else if (/\b(today'?s plan|full plan|study plan for tomorrow|plan tomorrow|what should i study tomorrow|targets|schedule|what should i study)\b/i.test(normalized) || 
      (input.orchestratorIntent === 'planning' && !/\b(make|create|give me)\b/i.test(normalized))) {
    policyIntent = 'planning_query';
  } else if (/\b(analy[sz]e my test|check my mock|autopsy|test analysis|paper analysis|analyze mistakes|why did i lose marks|mistake analysis)\b/i.test(normalized) || 
      (input.intent === 'AUTOPSY' && !/\b(make|create|generate)\b/i.test(normalized))) {
    policyIntent = 'autopsy_query';
  }

  // Detect plan edits
  const isPlanEdit = /\b(add|remove|change|shift|lighten|increase|mark|replace|update|create|generate|make)\b/i.test(normalized) && 
                     /\b(plan|target|targets|task|tasks|microtask|microtasks|schedule|today|tomorrow)\b/i.test(normalized);

  if (isPlanEdit) {
    try {
      const service = new DailyMicrotaskService(input.supabase);
      const today = new Date().toISOString().split('T')[0];
      const currentTasks = await service.getMicrotasksForDate(input.userId, today, input.goalId ?? undefined);
      
      const editPrompt = `You are a study plan editor. The user wants to edit their plan.
User request: "${input.message}"
Current tasks: ${JSON.stringify(currentTasks.map(t => ({ id: t.id, title: t.title, status: t.status, minutes: t.estimated_minutes })))}
Weak concepts: ${input.mindContext?.weakConcepts?.map((c: any) => c.name).join(', ') || 'None'}
Recent topic: ${input.mindContext?.recentTopics?.[0] || 'Unknown'}

Determine the actions to take. Return ONLY valid JSON:
{
  "actions": [
    {
      "type": "add",
      "title": "<title>",
      "subject": "<optional subject>",
      "estimated_minutes": 15
    },
    {
      "type": "remove",
      "taskId": "<id>"
    },
    {
      "type": "mark_done",
      "taskId": "<id>"
    }
  ],
  "responseMessage": "<Short confirmation message to the user>"
}
If the user wants to clear the plan, use "remove" for all. If they want to lighten, remove some. 
If they ask to update or generate targets generally, use "add" to create a few targeted tasks based on their weak concepts or recent topics.`;

      const editResult = await budgetedGenerateJSON<any>({
        userId: input.userId,
        feature: 'planner',
        route: 'chat:plan-edit',
        model: 'flash',
        systemPrompt: 'Return ONLY JSON.',
        userPrompt: editPrompt,
        maxOutputTokens: 700,
      });
      if (editResult && editResult.actions) {
        for (const action of editResult.actions) {
          if (action.type === 'add') {
            await service.addMicrotask({
              user_id: input.userId,
              task_date: today,
              title: action.title,
              subject: action.subject || null,
              type: 'custom',
              estimated_minutes: action.estimated_minutes || 15,
              status: 'pending',
              priority: 'medium',
              source: 'mind',
              goal_id: input.goalId ?? null,
            });
          } else if (action.type === 'remove' && action.taskId) {
            await service.deleteMicrotask(action.taskId, input.userId);
          } else if (action.type === 'mark_done' && action.taskId) {
            await service.updateMicrotaskStatus(action.taskId, input.userId, 'done');
          }
        }
        const { invalidateSessionCards } = await import('@/lib/services/session-card-invalidation');
        await invalidateSessionCards(input.userId, input.supabase, 'chat_planner_tasks_updated');
        return {
          text: editResult.responseMessage || 'I have updated your plan for today.',
          metadata: { action: 'planner_adjusted', tasksModified: true, sessionCardInvalidated: true }
        };
      }
    } catch (err) {
      console.error('Plan edit failed', err);
    }
  }

  if (policyIntent === 'direct_generation') {
    return null;
  }

  if (policyIntent === 'planning_query') {
    const targetDate = localDateAfter(/\btomorrow\b/i.test(normalized) ? 1 : 0);
    const planResult = await ensureCommandPlanForDate({
      userId: input.userId,
      date: targetDate,
      client: input.supabase,
    });
    
    if (targetDate === new Date().toISOString().split('T')[0]) {
      try {
      const service = new DailyMicrotaskService(input.supabase);
      const existingMicrotasks = await service.getMicrotasksForDate(input.userId, targetDate, input.goalId ?? undefined);
      if (existingMicrotasks.length === 0 && planResult.tasks.length > 0) {
          for (const task of planResult.tasks) {
            await service.addMicrotask({
              user_id: input.userId,
              task_date: targetDate,
              title: task.title,
              subject: task.subject || null,
              topic: task.chapter || null,
              type: task.type === 'study' ? 'concept' : task.type,
              estimated_minutes: task.estimated_minutes,
              status: 'pending',
              priority: task.priority,
              source: 'system',
              goal_id: input.goalId ?? null,
            });
          }
        }
      } catch (err) {
        console.error('Failed to auto-expand plan into microtasks', err);
      }
    }
    
    return null;
  }

  if (policyIntent === 'atlas_query') {
    return {
      text: formatWeakAreasForChat({
        weakConcepts: input.mindContext?.weakConcepts ?? [],
        recentMistakes: input.mindContext?.recentMistakes ?? [],
        masteryPercent: input.mindContext?.masteryStats?.masteryPercent ?? 0,
      }),
      metadata: {
        action: 'answer_atlas_inline',
        weakConceptCount: input.mindContext?.weakConcepts?.length ?? 0,
        mistakeCount: input.mindContext?.recentMistakes?.length ?? 0,
      },
    };
  }

  if (policyIntent === 'memory_query') {
    return {
      text: formatRevisionQueueForChat({
        dueCount: input.mindContext?.overdueCardsCount ?? 0,
        cards: input.mindContext?.topOverdueCards ?? [],
      }),
      metadata: {
        action: 'answer_memory_inline',
        dueCardCount: input.mindContext?.overdueCardsCount ?? 0,
      },
    };
  }

  if (policyIntent === 'autopsy_query') {
    return {
      text: [
        'Mistake Review needs evidence before it can diagnose. Upload or paste one of these inside this chat:',
        '1. answer key plus your answers',
        '2. OMR or response sheet',
        '3. score/subject breakdown',
        '4. mistake rows with question, correct answer, your answer, and chapter',
        "I will only update Progress, Review, and Today's Mission from evidence-backed mistakes.",
      ].join('\n'),
      metadata: {
        action: 'request_autopsy_evidence',
      },
    };
  }

  return null;
}
