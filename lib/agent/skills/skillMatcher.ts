/**
 * Skill Matcher - find skills relevant to the current context.
 */
import type { AgentSkill, SkillMatch } from './skillTypes';
import type { JsonObject } from '../types';

/**
 * Match skills against the current agent context.
 * Returns top-matched skills with scores and reasons.
 */
export function matchSkillsForContext(
  skills: AgentSkill[],
  context: {
    channel: string;
    goalId?: string | null;
    conceptName?: string;
    signalTypes?: string[];
    weakConceptCount?: number;
    dueCardCount?: number;
  },
  limit: number = 3
): SkillMatch[] {
  const scored = skills.map(skill => {
    let score = 0;
    const reasons: string[] = [];

    // Scope scoring
    if (skill.scope === 'global') {
      score += 0.3;
      reasons.push('global scope');
    }
    if (skill.scope === 'goal' && context.goalId && skill.goal_id === context.goalId) {
      score += 0.8;
      reasons.push('goal match');
    }
    if (skill.scope === 'user' && skill.user_id) {
      score += 0.6;
      reasons.push('user scope');
    }

    // Concept/scoped match
    if (context.conceptName && skill.trigger?.conceptName) {
      const triggerConcept = String(skill.trigger.conceptName).toLowerCase();
      const contextConcept = context.conceptName.toLowerCase();
      if (triggerConcept.includes(contextConcept) || contextConcept.includes(triggerConcept)) {
        score += 0.7;
        reasons.push('concept match');
      }
    }

    // Signal type match
    if (context.signalTypes && skill.trigger?.signalTypes) {
      const matchingSignals = context.signalTypes.filter(s =>
        skill.trigger.signalTypes?.includes(s)
      );
      if (matchingSignals.length > 0) {
        score += 0.5 * (matchingSignals.length / Math.max(skill.trigger.signalTypes.length, 1));
        reasons.push(`${matchingSignals.length} signal type(s) match`);
      }
    }

    // Channel match
    if (skill.trigger?.channel && skill.trigger.channel.includes(context.channel)) {
      score += 0.4;
      reasons.push('channel match');
    }

    // Success rate bonus
    if (skill.success_count > 0) {
      const total = skill.success_count + skill.failure_count;
      const successRate = skill.success_count / total;
      score += successRate * 0.3;
      reasons.push(`${Math.round(successRate * 100)}% success rate`);
    }

    // Penalize if not active or never used (prefer proven skills)
    if (skill.status === 'draft') {
      score -= 0.2;
      reasons.push('draft skill');
    }
    if (skill.success_count + skill.failure_count === 0) {
      score -= 0.1;
      reasons.push('unused skill');
    }

    return {
      skill,
      matchScore: score,
      matchReason: reasons.slice(0, 3).join(', ') || 'default match',
    };
  });

  return scored
    .filter(s => s.matchScore > 0.2)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, limit);
}

/**
 * Extract which skill to use from a plan's required_tools if the model
 * requests a skill by name.
 */
export function matchSkillByName(
  skills: AgentSkill[],
  requestedName: string
): AgentSkill | null {
  const normalized = requestedName.toLowerCase().replace(/[-_\s]+/g, '');

  return (
    skills.find(s => {
      const skillName = s.name.toLowerCase().replace(/[-_\s]+/g, '');
      return skillName === normalized || s.name.toLowerCase().includes(normalized);
    }) ?? null
  );
}

/**
 * Check if a repeated pattern is stable enough to create a skill.
 * Requires at least 3 repeated detections before suggesting skill creation.
 */
export function isPatternStable(
  repeatedCounts: Map<string, number>,
  pattern: string,
  minRepetitions: number = 3
): boolean {
  return (repeatedCounts.get(pattern) ?? 0) >= minRepetitions;
}