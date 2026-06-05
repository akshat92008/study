export type HermesIntentType =
  | 'create_goal'
  | 'get_today_mission'
  | 'check_source_status'
  | 'upload_source'
  | 'generate_quiz'
  | 'submit_quiz'
  | 'run_autopsy'
  | 'create_flashcards'
  | 'get_due_reviews'
  | 'show_weak_areas'
  | 'explain_concept'
  | 'plan_study_session'
  | 'summarize_progress'
  | 'open_module'
  | 'unknown';

export type HermesIntent = {
  type: HermesIntentType;
  confidence: number;
  entities: {
    goalTitle?: string;
    subject?: string;
    topic?: string;
    sourceId?: string;
    module?: string;
  };
  requiresLLM: boolean;
  reason: string;
};

export type HermesTask = {
  id?: string;
  title: string;
  subject?: string | null;
  topic?: string | null;
  estimatedMinutes?: number | null;
  priority?: string | null;
  status?: string | null;
  type?: string | null;
};

export type HermesRoadmapNode = {
  id?: string;
  title: string;
  subject?: string | null;
  chapter?: string | null;
  topic?: string | null;
  status?: string | null;
  orderIndex?: number | null;
};

export type HermesSourceStatus = {
  id: string;
  title: string;
  status: string;
  label: string;
  canRetry: boolean;
  retryCount?: number | null;
  lastError?: string | null;
  updatedAt?: string | null;
};

export type HermesCardAction = {
  id: string;
  label: string;
  type:
    | 'open_module'
    | 'start_mission'
    | 'upload_source'
    | 'generate_quiz'
    | 'run_autopsy'
    | 'create_flashcards'
    | 'retry_source'
    | 'open_review'
    | 'open_goal';
  payload?: Record<string, unknown>;
};

export type HermesCard =
  | { type: 'text'; text: string }
  | { type: 'mission'; title: string; tasks: HermesTask[]; actions: HermesCardAction[] }
  | { type: 'roadmap'; goalTitle: string; nodes: HermesRoadmapNode[]; actions: HermesCardAction[] }
  | { type: 'source_status'; sources: HermesSourceStatus[]; actions: HermesCardAction[] }
  | { type: 'quiz'; title: string; questions: any[]; actions: HermesCardAction[] }
  | { type: 'autopsy'; title: string; diagnosis: string; nextActions: string[]; actions: HermesCardAction[] }
  | { type: 'flashcards'; title: string; cards: any[]; actions: HermesCardAction[] }
  | { type: 'review_queue'; dueCount: number; actions: HermesCardAction[] }
  | { type: 'weak_areas'; topics: any[]; actions: HermesCardAction[] }
  | { type: 'progress_summary'; summary: string; stats: any; actions: HermesCardAction[] }
  | { type: 'clarification'; question: string; suggestions: string[] };

export type HermesUserState = {
  userId: string;
  activeGoal: null | {
    id: string;
    title: string;
    subject?: string | null;
    domain?: string | null;
    exam_type?: string | null;
    progress?: number | null;
    metadata?: any;
  };
  counts: {
    sourcesReady: number;
    sourcesProcessing: number;
    sourcesFailed: number;
    dueCards: number;
    weakConcepts: number;
    recentMistakes: number;
    pendingMicrotasks: number;
  };
  todayTasks: HermesTask[];
  sourceStatuses: HermesSourceStatus[];
  latestAutopsy?: any;
  latestSessionCard?: any;
  nextAction?: any;
  profileSummary?: any;
  warnings: string[];
};

export type HermesCostMode = 'lite' | 'heavy' | 'none';

export type HermesPlannedTool = {
  name:
    | 'createGoalFromText'
    | 'getOrCreateTodayMission'
    | 'getSourceStatuses'
    | 'retrySourceProcessing'
    | 'getDueReviews'
    | 'getWeakAreas'
    | 'generateQuizForTopic'
    | 'submitQuizAttempt'
    | 'runMistakeAutopsy'
    | 'createFlashcardsFromTopic'
    | 'askTutorWithContext'
    | 'summarizeProgress';
  args: Record<string, unknown>;
  heavyReason?: string;
};

export type HermesPlan = {
  cards: HermesCard[];
  tools: HermesPlannedTool[];
  usedLLM: boolean;
  costMode: HermesCostMode;
  warnings: string[];
};
