// ============================================
// CORE DOMAIN TYPES
// ============================================

// Exam types the system supports
export type ExamType = string;

// Generic subject type (dynamically loaded from EXAM_REGISTRY)
export type Subject = string;

// Mastery levels for concepts
export type MasteryLevel = 
  | 'not_started'    // Never encountered
  | 'exposed'        // Seen but not understood
  | 'developing'     // Partial understanding
  | 'proficient'     // Can solve standard problems
  | 'mastered'       // Can solve complex problems
  | 'automated';     // Instant recall, no effort

// Confidence levels
export type ConfidenceLevel = 'very_low' | 'low' | 'medium' | 'high' | 'very_high';

// Mistake categories
export type MistakeCategory =
  | 'conceptual'          // Fundamental misunderstanding
  | 'calculation'         // Math/arithmetic error
  | 'silly'              // Careless mistake
  | 'time_pressure'      // Ran out of time
  | 'misread'            // Misread question
  | 'incomplete_knowledge' // Didn't know enough
  | 'overconfidence'     // Thought they knew, didn't
  | 'anxiety'            // Stress-induced error
  | 'recall_failure';    // Knew it but couldn't recall

// Emotional states
export type EmotionalState = 
  | 'focused'
  | 'motivated'
  | 'stressed'
  | 'burnt_out'
  | 'anxious'
  | 'frustrated'
  | 'confident'
  | 'overwhelmed'
  | 'bored'
  | 'neutral';

// ============================================
// COGNITION GRAPH TYPES
// ============================================

export interface ConceptNode {
  id: string;
  name: string;
  subject: string;
  chapter: string;
  topic: string;
  mastery: MasteryLevel;
  confidence: ConfidenceLevel;
  lastReviewed: Date | null;
  timesReviewed: number;
  timesCorrect: number;
  timesIncorrect: number;
  forgettingProbability: number; // 0-1
  retentionStrength: number;    // 0-1
  connections: string[];        // IDs of related concepts
}

export interface CognitionSnapshot {
  userId: string;
  timestamp: Date;
  knowledgeState: {
    totalConcepts: number;
    mastered: number;
    developing: number;
    weak: number;
    notStarted: number;
    overallMastery: number; // 0-100
  };
  behavioralState: {
    consistency: number;       // 0-100
    focusQuality: number;      // 0-100
    procrastinationIndex: number; // 0-100
    burnoutRisk: number;       // 0-100
  };
  memoryState: {
    averageRetention: number;  // 0-100
    conceptsDueForReview: number;
    forgettingRate: number;    // concepts/day
  };
  performanceState: {
    averageScore: number;
    scoreTrajectory: 'improving' | 'declining' | 'plateau';
    predictedScore: number;
    weakSubjects: string[];
  };
  emotionalState: EmotionalState;
}

// ============================================
// MISTAKE INTELLIGENCE TYPES
// ============================================

export interface MistakeRecord {
  id: string;
  userId: string;
  conceptId: string;
  questionId: string | null;
  category: MistakeCategory;
  subject: string;
  chapter: string;
  topic: string;
  description: string;
  marksLost: number;
  totalMarks: number;
  timeSpent: number;        // seconds
  timeAllotted: number;     // seconds
  isRecurring: boolean;
  occurrenceCount: number;
  aiAnalysis: string;       // AI-generated analysis
  improvementSuggestion: string;
  createdAt: Date;
}

export interface MistakePattern {
  category: MistakeCategory;
  frequency: number;
  totalMarksLost: number;
  affectedConcepts: string[];
  trend: 'increasing' | 'decreasing' | 'stable';
  rootCause: string;        // AI-generated
  actionPlan: string;       // AI-generated
}

// ============================================
// REVISION ENGINE TYPES
// ============================================

export interface RevisionCard {
  id: string;
  userId: string;
  conceptId: string;
  front: string;            // Question/prompt
  back: string;             // Answer/explanation
  // FSRS fields
  due: Date;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  state: number;            // FSRS state (New, Learning, Review, Relearning)
  lastReview: Date | null;
}

export type RevisionRating = 'again' | 'hard' | 'good' | 'easy';

// ============================================
// PLANNER TYPES
// ============================================

export interface StudyTask {
  id: string;
  userId: string;
  title: string;
  description: string;
  type: 'study' | 'revision' | 'practice' | 'mock_test' | 'break' | 'review';
  subject: string;
  chapter: string | null;
  priority: 'critical' | 'high' | 'medium' | 'low';
  estimatedMinutes: number;
  scheduledDate: Date;
  scheduledStartTime: string; // HH:mm
  isCompleted: boolean;
  completedAt: Date | null;
  focusScore: number | null;  // 0-100
  notes: string | null;
}

export interface DailyPlan {
  date: Date;
  tasks: StudyTask[];
  totalStudyMinutes: number;
  totalBreakMinutes: number;
  focusBlocks: number;
  overallPriority: string;
  aiInsight: string;         // AI-generated daily insight
}

// ============================================
// ANALYTICS TYPES
// ============================================

export interface PerformanceMetrics {
  userId: string;
  period: 'daily' | 'weekly' | 'monthly';
  date: Date;
  studyHours: number;
  conceptsLearned: number;
  conceptsRevised: number;
  questionsAttempted: number;
  questionsCorrect: number;
  accuracy: number;
  averageScore: number;
  streakDays: number;
  focusScore: number;
  productivityScore: number;
  learningVelocity: number;  // concepts per hour
  retentionRate: number;
}

export interface MockTestResult {
  id: string;
  userId: string;
  testName: string;
  totalQuestions: number;
  attempted: number;
  correct: number;
  incorrect: number;
  unattempted: number;
  totalMarks: number;
  marksObtained: number;
  negativeMarks: number;
  timeTaken: number;       // minutes
  totalTime: number;       // minutes
  subjectWise: {
    subject: string;
    correct: number;
    incorrect: number;
    unattempted: number;
    marks: number;
    timeSpent: number;
  }[];
  createdAt: Date;
}

// ============================================
// AI AGENT TYPES
// ============================================

export interface MentorMessage {
  id: string;
  role: 'user' | 'mentor';
  content: string;
  timestamp: Date;
  metadata?: {
    emotionalState?: EmotionalState;
    actionItems?: string[];
    relatedConcepts?: string[];
  };
}

export interface TutorSession {
  id: string;
  userId: string;
  conceptId: string;
  messages: TutorMessage[];
  startedAt: Date;
  endedAt: Date | null;
  cognitiveLevel: 'beginner' | 'intermediate' | 'advanced';
  understandingGained: number; // 0-100
}

export interface TutorMessage {
  id: string;
  role: 'user' | 'tutor';
  content: string;
  timestamp: Date;
  hasLatex: boolean;
  hasImage: boolean;
}
