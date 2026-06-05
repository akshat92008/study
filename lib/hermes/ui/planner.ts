import {
  clarificationCard,
  missionCard,
  reviewQueueCard,
  sourceStatusCard,
} from './cards';
import { evaluateHermesHeavyPolicy } from './cost-policy';
import type { HermesIntent, HermesPlan, HermesUserState } from './types';

function heavyTool(name: HermesPlan['tools'][number]['name'], intent: HermesIntent, args: Record<string, unknown> = {}, reason?: string): HermesPlan {
  const policy = evaluateHermesHeavyPolicy(intent, reason);
  if (!policy.allowed) {
    return {
      cards: [clarificationCard('That command needs more context before Hermes can run it safely.', [])],
      tools: [],
      usedLLM: false,
      costMode: 'none',
      warnings: [policy.reason],
    };
  }
  return {
    cards: [],
    tools: [{ name, args, heavyReason: policy.reason }],
    usedLLM: true,
    costMode: 'heavy',
    warnings: [],
  };
}

export function planHermesAction(intent: HermesIntent, state: HermesUserState, input: string): HermesPlan {
  switch (intent.type) {
    case 'get_today_mission':
      if (!state.activeGoal) {
        return {
          cards: [clarificationCard('Create a learning goal first?', ['Create a goal for NEET Biology', 'Master Physics Class 12'])],
          tools: [],
          usedLLM: false,
          costMode: 'none',
          warnings: state.warnings,
        };
      }
      if (state.todayTasks.length > 0) {
        return {
          cards: [missionCard('Today\'s mission', state.todayTasks)],
          tools: [],
          usedLLM: false,
          costMode: 'lite',
          warnings: state.warnings,
        };
      }
      return {
        cards: [],
        tools: [{ name: 'getOrCreateTodayMission', args: {} }],
        usedLLM: false,
        costMode: 'lite',
        warnings: state.warnings,
      };

    case 'check_source_status':
      return {
        cards: [sourceStatusCard(state.sourceStatuses)],
        tools: [],
        usedLLM: false,
        costMode: 'lite',
        warnings: state.warnings,
      };

    case 'show_weak_areas':
      return {
        cards: [],
        tools: [{ name: 'getWeakAreas', args: {} }],
        usedLLM: false,
        costMode: 'lite',
        warnings: state.warnings,
      };

    case 'get_due_reviews':
      return {
        cards: [reviewQueueCard(state.counts.dueCards)],
        tools: [],
        usedLLM: false,
        costMode: 'lite',
        warnings: state.warnings,
      };

    case 'create_goal':
      return {
        cards: [],
        tools: [{ name: 'createGoalFromText', args: { goalTitle: intent.entities.goalTitle ?? input } }],
        usedLLM: false,
        costMode: 'lite',
        warnings: state.warnings,
      };

    case 'generate_quiz':
      return heavyTool('generateQuizForTopic', intent, { topic: intent.entities.topic }, 'quiz generation requested');

    case 'create_flashcards':
      return heavyTool('createFlashcardsFromTopic', intent, { topic: intent.entities.topic }, 'flashcard generation requested');

    case 'run_autopsy': {
      const match = input.match(/question:\s*([\s\S]*?)\s+my answer:\s*([\s\S]*?)\s+correct answer:\s*([\s\S]*)$/i);
      if (!match) {
        return {
          cards: [clarificationCard('Send the question, your answer, and the correct answer.', [
            'Question: ... My answer: ... Correct answer: ...',
          ])],
          tools: [],
          usedLLM: false,
          costMode: 'none',
          warnings: state.warnings,
        };
      }
      return heavyTool('runMistakeAutopsy', intent, {
        question: match[1].trim(),
        myAnswer: match[2].trim(),
        correctAnswer: match[3].trim(),
      }, 'mistake autopsy requested');
    }

    case 'explain_concept':
      return heavyTool('askTutorWithContext', intent, {}, 'concept explanation requested');

    case 'summarize_progress':
      return {
        cards: [],
        tools: [{ name: 'summarizeProgress', args: {} }],
        usedLLM: false,
        costMode: 'lite',
        warnings: state.warnings,
      };

    case 'upload_source':
      return {
        cards: [clarificationCard('Upload the PDF or notes from Sources, then ask Hermes for source status.', ['Show source status'])],
        tools: [],
        usedLLM: false,
        costMode: 'none',
        warnings: state.warnings,
      };

    case 'open_module':
      return {
        cards: [{ type: 'text', text: `Opening ${intent.entities.module ?? 'module'}...` }],
        tools: [],
        usedLLM: false,
        costMode: 'none',
        warnings: state.warnings,
      };

    default:
      return {
        cards: [clarificationCard('I can help with missions, sources, reviews, weak areas, quizzes, flashcards, and goal setup.', [
          'What should I do now?',
          'Show source status',
          'Show weak areas',
        ])],
        tools: [],
        usedLLM: false,
        costMode: 'none',
        warnings: state.warnings,
      };
  }
}
