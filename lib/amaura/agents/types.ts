import { z } from 'zod';

export const AmauraAgentNameSchema = z.enum([
  'PracticePatternAgent',
  'AutopsyCascadeAgent',
  'SessionCloseAgent',
  'ForgettingAgent',
  'StagnationAgent',
  'PatternMemoryAgent',
  'MissionAgent',
  'MemoryAgent',
  'AtlasAgent',
]);

export type AmauraAgentName = z.infer<typeof AmauraAgentNameSchema>;

export const AmauraNotificationPrioritySchema = z.enum([
  'silent',
  'low',
  'normal',
  'important',
  'urgent',
]);

export type AmauraNotificationPriority = z.infer<typeof AmauraNotificationPrioritySchema>;

export const AmauraAgentResultSchema = z.object({
  actionsTaken: z.number().int().nonnegative().default(0),
  notificationsCreated: z.number().int().nonnegative().default(0),
  cardsCreated: z.number().int().nonnegative().default(0),
  conceptsUpdated: z.number().int().nonnegative().default(0),
  missionInvalidated: z.boolean().default(false),
  skipped: z.boolean().default(false),
  skipReason: z.string().nullable().default(null),
  aiCallsUsed: z.number().int().nonnegative().default(0),
});

export type AmauraAgentResult = z.infer<typeof AmauraAgentResultSchema>;

export type AmauraBudgetPolicy = {
  maxAiCalls: number;
  model: 'gemini-flash' | 'none';
  requireBudget: boolean;
};

export type AmauraIdempotencyPolicy = {
  scope: 'event' | 'user-day' | 'user-concept-window';
  windowHours?: number;
};

export type AmauraNotificationPolicy = {
  priority: AmauraNotificationPriority;
  maxPerWindow?: number;
  windowHours?: number;
};

export type AmauraRetryPolicy = {
  maxRetries: number;
  retryable: boolean;
};

export type AmauraBudgetContext = {
  maxAiCalls: number;
  aiCallsUsed: number;
  canUseAi: () => Promise<boolean>;
  recordAiCall: () => Promise<boolean>;
};

export type AmauraAgentContext = {
  userId: string;
  goalId: string | null;
  eventId: string;
  eventType: string;
  idempotencyKey: string;
  now: Date;
  logger: {
    info: (message: string, meta?: Record<string, unknown>) => void;
    warn: (message: string, meta?: Record<string, unknown>) => void;
    error: (message: string, meta?: Record<string, unknown>) => void;
  };
  budget: AmauraBudgetContext;
};

export type AmauraAgentDefinition<TInput = unknown, TOutput = AmauraAgentResult> = {
  name: AmauraAgentName;
  handledEvents: readonly string[];
  inputSchema: z.ZodTypeAny;
  outputSchema: z.ZodTypeAny;
  getDedupKey: (context: AmauraAgentContext, payload: TInput) => string;
  budget: AmauraBudgetPolicy;
  idempotency: AmauraIdempotencyPolicy;
  notification: AmauraNotificationPolicy;
  retry: AmauraRetryPolicy;
  run: (context: AmauraAgentContext, payload: TInput) => Promise<TOutput>;
};

export function emptyAmauraResult(
  overrides: Partial<AmauraAgentResult> = {}
): AmauraAgentResult {
  return AmauraAgentResultSchema.parse({
    actionsTaken: 0,
    notificationsCreated: 0,
    cardsCreated: 0,
    conceptsUpdated: 0,
    missionInvalidated: false,
    skipped: false,
    skipReason: null,
    aiCallsUsed: 0,
    ...overrides,
  });
}

export function skippedAmauraResult(skipReason: string): AmauraAgentResult {
  return emptyAmauraResult({
    skipped: true,
    skipReason,
  });
}

export const AnyPayloadSchema = z.record(z.unknown()).default({});
