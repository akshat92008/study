import { SupabaseClient } from '@supabase/supabase-js';
import { budgetedStreamGeneration, budgetedGenerateJSON } from '@/lib/ai/budgeted';
import { buildConversationMessages } from '@/lib/ai/chat-intent';
import { invalidateSessionCards } from '@/lib/services/session-card-cache';
import { logger } from '@/lib/utils/logger';
import { z } from 'zod';

export class ChatPlannerService {
  static async handleReplan(
    supabase: SupabaseClient,
    userId: string,
    action: string,
    controller: ReadableStreamDefaultController,
    encoder: TextEncoder
  ) {
    const today = new Date().toISOString().split('T')[0];
    const { data: todayTasks } = await supabase
      .from('study_tasks')
      .select('id, title, estimated_minutes, priority')
      .eq('user_id', userId)
      .eq('scheduled_date', today)
      .eq('is_completed', false)
      .order('priority', { ascending: false });

    if (!todayTasks || todayTasks.length === 0) {
      const reply = "You have no tasks left for today — nothing to adjust. Want me to build a lighter plan from scratch?";
      controller.enqueue(encoder.encode(reply));
      return { fullResponse: reply, metadataPayload: null };
    }

    let reply = '';
    if (action === 'reduce_tasks') {
      const removeCount = Math.max(1, Math.floor(todayTasks.length * 0.3));
      const toRemove = todayTasks.slice(0, removeCount);
      await supabase.from('study_tasks').delete().in('id', toRemove.map((t: any) => t.id)).eq('user_id', userId);
      const saved = toRemove.reduce((s: number, t: any) => s + (t.estimated_minutes || 0), 0);
      reply = `Done. Removed ${toRemove.length} task${toRemove.length > 1 ? 's' : ''} from today — ${saved} minutes freed. Focus on what remains.`;
      await invalidateSessionCards(userId, supabase, 'chat_replan_removed_tasks');
    } else if (action === 'lighten_intensity') {
      let saved = 0;
      for (const task of todayTasks) {
        if ((task.estimated_minutes || 0) > 25) {
          saved += task.estimated_minutes - 25;
          await supabase.from('study_tasks').update({ estimated_minutes: 25 }).eq('id', task.id).eq('user_id', userId);
        }
      }
      reply = `Done. All sessions capped at 25 minutes. ${saved} minutes saved. Short focused blocks are easier to start.`;
      await invalidateSessionCards(userId, supabase, 'chat_replan_lightened_intensity');
    } else {
      await supabase.from('study_tasks').insert({
        user_id: userId, title: 'Recovery Break', type: 'break', scheduled_date: today,
        estimated_minutes: 15, priority: 'low', is_completed: false,
      });
      reply = "Added a 15-minute recovery break. Step fully away from your desk — no studying.";
      await invalidateSessionCards(userId, supabase, 'chat_replan_added_recovery_break');
    }
    controller.enqueue(encoder.encode(reply));
    return {
      fullResponse: reply,
      metadataPayload: { action: 'planner_adjusted', tasksModified: true, sessionCardInvalidated: true }
    };
  }

  static async handleCreateArtifact(
    supabase: SupabaseClient,
    userId: string,
    systemPrompt: string,
    recentHistory: any[],
    message: string,
    controller: ReadableStreamDefaultController,
    encoder: TextEncoder
  ) {
    let fullResponse = '';
    const artifactSystemPrompt = `${systemPrompt}\n\nYou are in ARTIFACT CREATION mode. The learner has asked you to create a study plan, planner, revision sheet, or similar artifact.\n\nRules:\n- If they mention an upcoming test or deadline date, build a day-by-day study plan from today until that date.\n- Cover all weak areas from their Progress profile first, then fill remaining days with stronger subjects/topics.\n- Format the plan clearly with days, topics, and time estimates.\n- If the user simply asks to add a specific topic to their planner, output a short 1-day plan with just that task.\n- If they say "full syllabus" or "all subjects", cover all subjects/topics from their learning goal.\n- Be specific and actionable. Not generic.\n- End with one motivating line about what hitting this plan will accomplish.\n- IMPORTANT: Do NOT wrap the <artifact> tags in markdown code blocks (like \`\`\`xml). Output the raw <artifact> tags directly.`;
    const conversationMessages = buildConversationMessages(recentHistory, message);
    
    const generator = await budgetedStreamGeneration({
      userId,
      feature: 'chat',
      route: 'chat:planner',
      model: 'flash',
      systemPrompt: artifactSystemPrompt,
      userPrompt: conversationMessages,
      maxOutputTokens: 1600,
    });
    for await (const chunk of generator) {
      controller.enqueue(encoder.encode(chunk));
      fullResponse += chunk;
    }

    controller.enqueue(encoder.encode('\n\n*Scheduling microtargets to your dashboard...*'));
    fullResponse += '\n\n*Scheduling microtargets to your dashboard...*';

    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const extractPrompt = `You are a structured operational planner for Cognition OS.\nExtract a list of specific study tasks from this study plan to schedule in the learner's database.\nIf a task does not have a specific date mentioned, schedule it for today (${todayStr}).\n\nStudy Plan Text:\n${fullResponse}\n\nReturn ONLY valid JSON matching this schema:\n{\n  "tasks": [\n    {\n      "title": "Short title of the task (e.g. Study Newton's Laws, Revise Spanish Verbs, Practice Binary Trees)",\n      "subject": "<subject or domain inferred from context, e.g. Physics, Spanish, Algorithms>",\n      "chapter": "<chapter, module, or topic name>",\n      "estimated_minutes": 45,\n      "scheduled_date": "YYYY-MM-DD"\n    }\n  ]\n}`;
      const taskListSchema = z.object({
        tasks: z.array(z.object({
          title: z.string(), subject: z.string().optional().default('General'),
          chapter: z.string().optional().default(''), estimated_minutes: z.number().optional().default(45),
          scheduled_date: z.string().optional().default(todayStr)
        }))
      });

      const planData = await budgetedGenerateJSON<any>({
        userId,
        feature: 'chat',
        route: 'chat:planner-extract',
        model: 'flash',
        systemPrompt: 'Expert task extractor. Output JSON only.',
        userPrompt: extractPrompt,
        maxOutputTokens: 800,
      }).catch(() => null);

      if (planData && planData.tasks && planData.tasks.length > 0) {
        const tasksToInsert = planData.tasks.map((t: any) => ({
          user_id: userId, title: t.title, type: 'study', subject: t.subject || 'General',
          chapter: t.chapter || '', estimated_minutes: t.estimated_minutes || 45,
          scheduled_date: t.scheduled_date || todayStr, is_completed: false,
          notes: 'Auto-extracted from chat study planner.'
        }));
        const datesToUpdate = Array.from(new Set(tasksToInsert.map((t: any) => t.scheduled_date)));
        if (datesToUpdate.length > 0) {
           await supabase.from('study_tasks').delete().eq('user_id', userId).eq('is_completed', false).in('scheduled_date', datesToUpdate);
        }
        await supabase.from('study_tasks').insert(tasksToInsert);
        await invalidateSessionCards(userId, supabase, 'chat_planner_tasks_updated');
        return {
          fullResponse,
          metadataPayload: { action: 'planner_adjusted', tasksModified: true, sessionCardInvalidated: true }
        };
      }
    } catch (err) { logger.warn('Failed to extract and insert study tasks from planner', err); }

    return { fullResponse, metadataPayload: null };
  }
}
