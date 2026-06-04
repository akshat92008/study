export type LearningSignalType =
  | 'assessment_result'
  | 'question_mistake'
  | 'manual_mistake'
  | 'chat_confusion'
  | 'revision_review'
  | 'practice_attempt'
  | 'source_upload'
  | 'self_reflection'
  | 'task_completion'
  | 'autopsy_memory_created';

export interface LearningSignalInput {
  user_id: string;
  goal_id?: string | null;
  signal_type: LearningSignalType;
  source_type: string;
  source_id?: string | null;
  subject?: string | null;
  topic?: string | null;
  confidence?: number;
  evidence?: Record<string, unknown>;
  created_at?: string;
}

export interface NormalizedLearningSignal {
  user_id: string;
  goal_id: string | null;
  signal_type: LearningSignalType;
  source_type: string;
  source_id: string | null;
  subject: string | null;
  topic: string | null;
  confidence: number;
  evidence: Record<string, unknown>;
  created_at?: string;
}
