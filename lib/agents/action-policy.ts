import type { AgentActionType, AgentRiskLevel, JsonRecord } from './types';

const SAFE_AUTO = new Set<AgentActionType>([
  'create_rag_ingestion_job',
  'extract_document_text',
  'chunk_document',
  'embed_chunks',
  'store_citation',
  'log_source_usage',
  'create_session_recommendation',
  'plan_created',
  'create_low_risk_revision_card',
  'record_learning_evidence',
  'update_mastery_score',
  'tag_weak_topic',
  'record_mistake_pattern',
  'create_revision_due_item',
  'update_revision_priority',
  'invalidate_today_mission',
  'increase_topic_priority',
  'mark_concept_practiced',
  // 'flag_student_risk', -- PULSE action, intentionally excluded from MVP runtime
  'create_revision_card_from_verified_mistake',
  'update_mastery_from_evidence',
  'invalidate_session_card',
]);

const AUTO_WITH_UNDO = new Set<AgentActionType>([
  'create_revision_card',
  'link_chunk_to_concept',
  'small_mastery_update',
  'adjust_next_session',
  'update_revision_schedule',
]);

const REQUIRES_APPROVAL = new Set<AgentActionType>([
  'uncertain_autopsy_mistake',
  'low_confidence_concept_mapping',
  'major_mastery_drop',
  'bulk_mastery_update',
  'bulk_card_creation',
  'destructive_delete',
  'large_plan_rewrite',
  'apply_mock_without_clear_evidence',
  'replace_daily_plan',
  'skip_chapter',
  'reduce_test_frequency',
  'run_full_material_analysis',
  'run_vision_interpretation',
  'change_exam_strategy',
  'generate_large_strategy_plan',
]);

export function classifyAgentActionRisk(
  actionType: AgentActionType,
  confidence?: number | null,
  evidence: JsonRecord = {}
): AgentRiskLevel {
  if (REQUIRES_APPROVAL.has(actionType)) return 'requires_approval';

  const evidenceConfidence = numberFrom(evidence.confidence);
  const effectiveConfidence = confidence ?? evidenceConfidence;
  if (effectiveConfidence !== null && effectiveConfidence < 0.55) {
    return 'requires_approval';
  }

  if (actionType === 'small_mastery_update') {
    const delta = Math.abs(numberFrom(evidence.delta) ?? 0);
    if (delta >= 0.2) return 'requires_approval';
  }

  if (AUTO_WITH_UNDO.has(actionType)) return 'auto_with_undo';
  if (SAFE_AUTO.has(actionType)) return 'safe_auto';
  return 'requires_approval';
}

function numberFrom(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
