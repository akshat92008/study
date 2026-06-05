import type {
  HermesCard,
  HermesCardAction,
  HermesRoadmapNode,
  HermesSourceStatus,
  HermesTask,
} from './types';

export type {
  HermesCard,
  HermesCardAction,
  HermesRoadmapNode,
  HermesSourceStatus,
  HermesTask,
};

export function missionCard(title: string, tasks: HermesTask[]): HermesCard {
  return {
    type: 'mission',
    title,
    tasks,
    actions: [
      { id: 'start-mission', label: 'Start mission', type: 'start_mission' },
      { id: 'open-review', label: 'Open review', type: 'open_review' },
    ],
  };
}

export function sourceStatusCard(sources: HermesSourceStatus[]): HermesCard {
  return {
    type: 'source_status',
    sources,
    actions: [
      { id: 'upload-source', label: 'Upload source', type: 'upload_source' },
    ],
  };
}

export function reviewQueueCard(dueCount: number): HermesCard {
  return {
    type: 'review_queue',
    dueCount,
    actions: [
      { id: 'open-review', label: 'Open review', type: 'open_review' },
    ],
  };
}

export function weakAreasCard(topics: any[]): HermesCard {
  return {
    type: 'weak_areas',
    topics,
    actions: [
      { id: 'generate-quiz', label: 'Generate quiz', type: 'generate_quiz' },
      { id: 'create-flashcards', label: 'Create flashcards', type: 'create_flashcards' },
    ],
  };
}

export function clarificationCard(question: string, suggestions: string[] = []): HermesCard {
  return {
    type: 'clarification',
    question,
    suggestions,
  };
}

export function roadmapCard(goalTitle: string, nodes: HermesRoadmapNode[]): HermesCard {
  return {
    type: 'roadmap',
    goalTitle,
    nodes,
    actions: [
      { id: 'open-goal', label: 'Open goal', type: 'open_goal' },
      { id: 'start-mission', label: 'Start mission', type: 'start_mission' },
    ],
  };
}
