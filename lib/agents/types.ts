import { z } from 'zod';

export const AgentNameSchema = z.enum([
  'mind',
  'rag',
  'atlas',
  'memory',
  'autopsy',
  'planner',
  'pulse',
  'command',
  'system',
]);
export type AgentName = z.infer<typeof AgentNameSchema>;

export const AgentRunStatusSchema = z.enum([
  'queued',
  'running',
  'completed',
  'failed',
  'cancelled',
]);
export type AgentRunStatus = z.infer<typeof AgentRunStatusSchema>;

export const AgentActionStatusSchema = z.enum([
  'proposed',
  'pending_approval',
  'approved',
  'rejected',
  'applied',
  'skipped',
  'failed',
]);
export type AgentActionStatus = z.infer<typeof AgentActionStatusSchema>;

export const AgentRiskLevelSchema = z.enum([
  'safe_auto',
  'auto_with_undo',
  'requires_approval',
]);
export type AgentRiskLevel = z.infer<typeof AgentRiskLevelSchema>;

export const AgentApprovalStatusSchema = z.enum([
  'not_required',
  'pending',
  'approved',
  'rejected',
]);
export type AgentApprovalStatus = z.infer<typeof AgentApprovalStatusSchema>;

export const AgentTriggerTypeSchema = z.enum([
  'event',
  'request',
  'worker',
  'scheduled',
  'manual',
  'system',
]);
export type AgentTriggerType = z.infer<typeof AgentTriggerTypeSchema>;

export const AgentActionTypeSchema = z.enum([
  'create_rag_ingestion_job',
  'extract_document_text',
  'chunk_document',
  'embed_chunks',
  'store_citation',
  'log_source_usage',
  'create_session_recommendation',
  'create_low_risk_revision_card',
  'create_revision_card',
  'link_chunk_to_concept',
  'small_mastery_update',
  'adjust_next_session',
  'update_revision_schedule',
  'uncertain_autopsy_mistake',
  'low_confidence_concept_mapping',
  'major_mastery_drop',
  'bulk_mastery_update',
  'bulk_card_creation',
  'destructive_delete',
  'large_plan_rewrite',
  'apply_mock_without_clear_evidence',
]);
export type AgentActionType = z.infer<typeof AgentActionTypeSchema>;

export type JsonRecord = Record<string, unknown>;

export const AgentRunInputSchema = z.object({
  userId: z.string().uuid(),
  agentName: AgentNameSchema,
  triggerType: AgentTriggerTypeSchema,
  triggerEventId: z.string().uuid().nullable().optional(),
  triggerSource: z.string().nullable().optional(),
  inputSnapshot: z.record(z.unknown()).default({}),
  idempotencyKey: z.string().min(1),
});

export const AgentActionInputSchema = z.object({
  runId: z.string().uuid().nullable().optional(),
  userId: z.string().uuid(),
  agentName: AgentNameSchema,
  actionType: AgentActionTypeSchema,
  targetType: z.string().nullable().optional(),
  targetId: z.string().uuid().nullable().optional(),
  status: AgentActionStatusSchema.optional(),
  riskLevel: AgentRiskLevelSchema.optional(),
  approvalStatus: AgentApprovalStatusSchema.optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
  evidence: z.record(z.unknown()).default({}),
  reason: z.string().nullable().optional(),
  beforeState: z.record(z.unknown()).default({}),
  afterState: z.record(z.unknown()).default({}),
  idempotencyKey: z.string().min(1),
});

export type AgentRunInput = z.infer<typeof AgentRunInputSchema>;
export type AgentActionInput = z.infer<typeof AgentActionInputSchema>;
