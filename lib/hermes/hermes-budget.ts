// lib/hermes/hermes-budget.ts
// Maps Hermes model tiers to existing AIModelTier and BudgetFeature values.
// Uses existing cost-guard and budgeted system — no separate billing.

import type { AIModelTier } from '@/lib/ai/budgeted';
import type { BudgetFeature } from '@/lib/ai/cost-guard';
import type { HermesFeature, HermesModelTier } from './hermes-types';
import { getHermesConfig } from './hermes-config';

export function resolveModelTier(tier: HermesModelTier): AIModelTier {
  const config = getHermesConfig();
  return tier === 'strong' ? config.strongModel : config.fastModel;
}

export function featureToModelTier(feature: HermesFeature): HermesModelTier {
  const config = getHermesConfig();
  if (feature === 'hermes_mistake' && config.useStrongForMistakes) {
    return 'strong';
  }
  // All other features use fast by default to control cost
  return 'fast';
}

export function hermesFeatureToBudgetFeature(feature: HermesFeature): BudgetFeature {
  // Map Hermes features to the budget feature enum
  const mapping: Record<HermesFeature, BudgetFeature> = {
    hermes_mistake: 'hermes_mistake',
    hermes_source: 'hermes_source',
    hermes_revision: 'hermes_revision',
    hermes_trace: 'hermes_trace',
    hermes_next_action: 'hermes_next_action',
    hermes_coding: 'hermes_mistake', // stub: maps to cheapest
  };
  return mapping[feature];
}

export function getHermesMaxOutputTokens(feature: HermesFeature): number {
  const config = getHermesConfig();
  // Mistake agent needs more tokens for cards + diagnosis
  if (feature === 'hermes_mistake') {
    return Math.min(config.maxOutputTokens, 1400);
  }
  return config.maxOutputTokens;
}
