export type CheapAgentName =
  | 'MEMORY'
  | 'ATLAS'
  | 'AUTOPSY'
  | 'REVISION'
  | 'COMMAND'
  // | 'PULSE' -- intentionally excluded from MVP runtime
  | 'MIND';

export type CheapAgentRiskLevel = 'safe' | 'medium' | 'high';

export type CheapAgentActionStatus =
  | 'proposed'
  | 'approved'
  | 'applied'
  | 'rejected'
  | 'skipped'
  | 'failed';

export type CheapAgentAction = {
  userId: string;
  eventId?: string | null;
  agent: CheapAgentName;
  actionType: string;
  riskLevel?: CheapAgentRiskLevel;
  status?: CheapAgentActionStatus;
  reason: string;
  confidence: number;
  payload: Record<string, unknown>;
};

export type LearningEvent = {
  id?: string | null;
  userId: string;
  type: string;
  payload: Record<string, unknown>;
  createdAt?: string | null;
};

export type CheapAgentCycleResult = {
  applied: number;
  proposed: number;
  skipped: number;
  failed: number;
  actions: Array<{
    agent: string;
    actionType: string;
    status: string;
    reason?: string;
  }>;
};
