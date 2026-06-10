import type { FeatureName } from '@/lib/usage/enforce-feature-limit';
import { getUserAccessState } from '@/lib/access/beta-access';
import { type SubscriptionTier, normalizeSubscriptionTier } from './tiers';

export type PlanLimits = {
  dailyChatMessages: number;
  dailyAiCalls: number;
  dailyAutopsyReports: number;
  dailyRagUploads: number;
  dailyMaterialQueries: number;
  dailyHermesWrites: number;
  dailyRevisionGenerations: number;
  maxMaterials: number;
  maxAssessments: number;
  maxFileMb: number;
  monthlyAiBudgetUsd: number;
};

export const PLAN_LIMITS: Record<SubscriptionTier, PlanLimits> = {
  free: {
    dailyChatMessages: 3,
    dailyAiCalls: 3,
    dailyAutopsyReports: 0,
    dailyRagUploads: 0,
    dailyMaterialQueries: 3,
    dailyHermesWrites: 0,
    dailyRevisionGenerations: 0,
    maxMaterials: 0,
    maxAssessments: 1,
    maxFileMb: 5,
    monthlyAiBudgetUsd: 0.1,
  },
  founding: {
    dailyChatMessages: 40,
    dailyAiCalls: 25,
    dailyAutopsyReports: 2,
    dailyRagUploads: 2,
    dailyMaterialQueries: 20,
    dailyHermesWrites: 20,
    dailyRevisionGenerations: 5,
    maxMaterials: 10,
    maxAssessments: 20,
    maxFileMb: 8,
    monthlyAiBudgetUsd: 1.5,
  },
  pro: {
    dailyChatMessages: 80,
    dailyAiCalls: 50,
    dailyAutopsyReports: 4,
    dailyRagUploads: 4,
    dailyMaterialQueries: 50,
    dailyHermesWrites: 40,
    dailyRevisionGenerations: 10,
    maxMaterials: 25,
    maxAssessments: 50,
    maxFileMb: 10,
    monthlyAiBudgetUsd: 3,
  },
  admin: {
    dailyChatMessages: 150,
    dailyAiCalls: 150,
    dailyAutopsyReports: 20,
    dailyRagUploads: 50,
    dailyMaterialQueries: 500,
    dailyHermesWrites: 500,
    dailyRevisionGenerations: 100,
    maxMaterials: 500,
    maxAssessments: 500,
    maxFileMb: 1000,
    monthlyAiBudgetUsd: 100,
  },
};

export function getPlanLimits(plan: SubscriptionTier | string | null | undefined): PlanLimits {
  return PLAN_LIMITS[normalizeSubscriptionTier(plan)];
}

export function getFeatureLimit(plan: SubscriptionTier | string | null | undefined, feature: FeatureName): number {
  const limits = getPlanLimits(plan);
  switch (feature) {
    case 'chat_message':
      return limits.dailyChatMessages;
    case 'ai_call':
    case 'worker_ai_call':
      return limits.dailyAiCalls;
    case 'autopsy_report':
      return limits.dailyAutopsyReports;
    case 'rag_upload':
    case 'material_upload':
      return limits.dailyRagUploads;
    case 'material_query':
      return limits.dailyMaterialQueries;
    case 'hermes_write':
      return limits.dailyHermesWrites;
    case 'revision_generation':
      return limits.dailyRevisionGenerations;
    case 'assessment_create':
      return limits.maxAssessments;
    default:
      return 0;
  }
}

export async function getUserEffectivePlan(userId: string): Promise<SubscriptionTier> {
  const access = await getUserAccessState(userId);
  return access.plan;
}
