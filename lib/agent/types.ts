import type { SupabaseClient } from '@supabase/supabase-js';
import type { z } from 'zod';

export type JsonObject = Record<string, unknown>;

export type AgentChannel = 'chat' | 'practice' | 'autopsy' | 'revision' | 'session' | 'background';

export interface CognitionAgentTurnInput {
  userId: string;
  channel: AgentChannel;
  userMessage?: string;
  payload?: JsonObject;
  conversationId?: string;
  sessionId?: string;
  goalId?: string;
}

export interface CognitionAgentRuntimeOptions {
  supabase?: SupabaseClient;
  idempotencyKey?: string;
  finalResponse?: string;
  maxToolCalls?: number;
  now?: Date;
}

export interface AgentObservation {
  channel: AgentChannel;
  userMessage: string;
  payload: JsonObject;
  conversationId: string | null;
  sessionId: string | null;
  goalId: string | null;
  sourceRequested: boolean;
  confusionLikely: boolean;
  practicePayload: boolean;
  autopsyPayload: boolean;
  sessionCompletionRequested: boolean;
}

export interface LearningSignal {
  type:
    | 'weak_area_detected'
    | 'misconception_detected'
    | 'concept_understood'
    | 'source_used'
    | 'revision_needed'
    | 'practice_needed'
    | 'explanation_generated'
    | 'session_should_adapt'
    | 'practice_attempt_submitted'
    | 'revision_reviewed'
    | 'session_completed';
  concept?: string;
  canonicalConcept?: string;
  subject?: string | null;
  chapter?: string | null;
  topic?: string | null;
  confidence: number;
  evidence?: string;
  source?: AgentChannel | 'source';
  materialId?: string;
  materialTitle?: string;
  chunkIds?: string[];
  attemptId?: string;
  correct?: boolean;
  misconception?: string;
  correction?: string;
  metadata?: JsonObject;
}

export interface RetrievedSourceChunk {
  id: string;
  materialId: string;
  title: string;
  text: string;
  score: number;
  method: 'vector' | 'keyword';
  subject?: string | null;
  chapter?: string | null;
  heading?: string | null;
  pageStart?: number | null;
  pageEnd?: number | null;
}

export interface AgentPlan {
  answer_intent: string;
  learning_signals: LearningSignal[];
  required_tools: Array<{ name: string; input: JsonObject }>;
  expected_mutations: string[];
  pedagogical_next_step: JsonObject;
  confidence: number;
  risk_flags: string[];
  // Hermes-class additions
  observations?: Array<{ type: string; summary: string; confidence: number }>;
  plan_source?: 'model' | 'deterministic';
  final_response_instruction?: string;
}

export interface AgentToolResult {
  success: boolean;
  changed: boolean;
  entityType?: string;
  entityIds?: string[];
  summary: string;
  data?: JsonObject;
  error?: {
    code: string;
    message: string;
    details?: JsonObject;
  };
}

export interface ToolCallRecord {
  id: string;
  name: string;
  input: JsonObject;
  startedAt: string;
  completedAt?: string;
}

export interface ToolResultRecord extends AgentToolResult {
  id: string;
  toolName: string;
  startedAt: string;
  completedAt: string;
}

export interface AgentContextSummary {
  profile?: JsonObject;
  activeGoal?: JsonObject | null;
  dailyMission?: JsonObject | null;
  atlas?: JsonObject;
  memory?: JsonObject;
  sources?: JsonObject;
  recent?: JsonObject;
  warnings?: string[];
}

export interface VerificationResult {
  ok: boolean;
  checks: Array<{
    name: string;
    ok: boolean;
    entityType?: string;
    entityId?: string;
    message: string;
  }>;
  warnings: string[];
  errors: string[];
}

export interface MutationSummary {
  changed: boolean;
  eventsWritten: number;
  conceptsCreated: number;
  conceptsUpdated: number;
  revisionCardsCreated: number;
  microtargetsUpdated: number;
  practiceAttemptsProcessed: number;
  sessionsCompleted: number;
  mistakesRecorded: number;
  warnings: string[];
}

export interface CognitionAgentTurnOutput {
  finalResponse?: string;
  trajectoryId: string;
  contextSummary: AgentContextSummary;
  sourceRetrievalSummary: JsonObject;
  agentPlan: AgentPlan;
  toolCalls: ToolCallRecord[];
  toolResults: ToolResultRecord[];
  learningSignals: LearningSignal[];
  mutationSummary: MutationSummary;
  verification: VerificationResult;
  nextRecommendedAction?: JsonObject;
  usedIterations?: number; // Added
  usedToolCalls?: number; // Added
}

export interface AgentToolContext {
  supabase: SupabaseClient;
  userId: string;
  channel: AgentChannel;
  conversationId?: string | null;
  sessionId?: string | null;
  goalId?: string | null;
  runId?: string | null;
  idempotencyKey: string;
  now: Date;
  observation: AgentObservation;
  contextSummary?: AgentContextSummary;
  sourceChunks?: RetrievedSourceChunk[];
  learningSignals?: LearningSignal[];
}

export interface AgentToolDefinition<Input extends z.ZodTypeAny = z.ZodTypeAny, Output extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  description: string;
  inputSchema: Input;
  outputSchema: Output;
  mutating: boolean;
  idempotent: boolean;
  maxCallsPerTurn: number;
  requiresAuth: boolean;
  handler: (input: z.infer<Input>, context: AgentToolContext) => Promise<z.infer<Output>>;
}
