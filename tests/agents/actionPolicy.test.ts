import { describe, expect, it } from 'vitest';
import { classifyAgentActionRisk } from '@/lib/agents/action-policy';
import { classifyAgentAction } from '@/lib/agents/policy';

describe('agent action policy', () => {
  it('classifies source-grounded ingestion actions as safe auto', () => {
    expect(classifyAgentActionRisk('create_rag_ingestion_job', 0.9)).toBe('safe_auto');
    expect(classifyAgentActionRisk('store_citation', 0.8)).toBe('safe_auto');
  });

  it('keeps reversible learner updates in auto-with-undo when confidence is healthy', () => {
    expect(classifyAgentActionRisk('create_revision_card', 0.75)).toBe('auto_with_undo');
    expect(classifyAgentActionRisk('small_mastery_update', 0.8, { delta: 0.08 })).toBe('auto_with_undo');
  });

  it('requires approval for risky or low-confidence actions', () => {
    expect(classifyAgentActionRisk('uncertain_autopsy_mistake', 0.9)).toBe('requires_approval');
    expect(classifyAgentActionRisk('small_mastery_update', 0.8, { delta: 0.25 })).toBe('requires_approval');
    expect(classifyAgentActionRisk('link_chunk_to_concept', 0.3)).toBe('requires_approval');
  });

  it('auto-applies only beta-approved cheap OS actions and proposes risky or unknown actions', () => {
    expect(classifyAgentAction('create_revision_card_from_verified_mistake')).toEqual({ riskLevel: 'safe', autoApply: true });
    expect(classifyAgentAction('update_mastery_from_evidence')).toEqual({ riskLevel: 'safe', autoApply: true });
    expect(classifyAgentAction('replace_daily_plan')).toEqual({ riskLevel: 'medium', autoApply: false });
    expect(classifyAgentAction('unknown_action')).toEqual({ riskLevel: 'medium', autoApply: false });
  });
});
