import 'server-only'

import {
  routeJSONGeneration,
  routeTextGeneration,
  routeStreamGeneration,
  routeVisionCall,
} from './router'
import {
  reserveBudgetForModelCall,
  commitBudgetUsage,
  releaseBudgetReservation,
  BudgetFeature,
} from './cost-guard'

export type AIModelTier = 'cheap' | 'flash' | 'balanced' | 'vision' | 'embedding' | 'fast' | 'quality' | 'pro' | 'router:daily-plan' | 'router:daily-briefing' | 'router:multimodal+pro' | 'router:flash+pro'

type BudgetedBase = {
  userId: string
  feature: BudgetFeature
  route?: string
  metadata?: Record<string, unknown>
}

type BudgetedGenerateJSONArgs<TSchema = unknown> = BudgetedBase & {
  model: AIModelTier
  systemPrompt: string
  userPrompt: string
  schema?: TSchema
  maxOutputTokens?: number
}

type BudgetedGenerateTextArgs = BudgetedBase & {
  model: AIModelTier
  systemPrompt: string
  userPrompt: string
  maxOutputTokens?: number
}

type BudgetedVisionArgs = BudgetedBase & {
  systemPrompt: string
  userMessage: string
  imageBase64?: string
  imageMimeType?: string
  fileText?: string
  maxOutputTokens?: number
}

async function runWithBudget<T>(
  args: BudgetedBase & {
    model: AIModelTier
    estimatedInputTokens: number
    estimatedOutputTokens: number
  },
  fn: (reservationId: string) => Promise<{
    value: T
    inputTokens?: number
    outputTokens?: number
    provider?: string
    model?: string
  }>
): Promise<T> {
  const reservation = await reserveBudgetForModelCall(
    args.userId,
    args.feature,
    args.model,
    args.estimatedInputTokens,
    args.estimatedOutputTokens
  )

  try {
    const result = await fn(reservation.reservationId)

    await commitBudgetUsage(reservation.reservationId, {
      promptTokens: result.inputTokens ?? args.estimatedInputTokens,
      completionTokens: result.outputTokens ?? args.estimatedOutputTokens,
      route: args.route,
    })

    return result.value
  } catch (error) {
    await releaseBudgetReservation(reservation.reservationId, error instanceof Error ? error.message : 'unknown_error').catch(() => null)
    throw error
  }
}

function estimateTokens(...parts: Array<string | undefined | null>) {
  const chars = parts.filter(Boolean).join('\n').length
  return Math.max(128, Math.ceil(chars / 4))
}

export async function budgetedGenerateJSON<T = unknown>(
  args: BudgetedGenerateJSONArgs<any>
): Promise<T> {
  return runWithBudget<T>(
    {
      userId: args.userId,
      feature: args.feature,
      route: args.route,
      model: args.model,
      metadata: args.metadata,
      estimatedInputTokens: estimateTokens(args.systemPrompt, args.userPrompt),
      estimatedOutputTokens: args.maxOutputTokens ?? 900,
    },
    async (reservationId) => {
      const value = await routeJSONGeneration<T>(
        args.systemPrompt,
        args.userPrompt,
        0.3,
        args.schema,
        reservationId,
        true // skipCommit since runWithBudget handles it
      )

      return {
        value,
        model: args.model,
      }
    }
  )
}

export async function budgetedGenerateText(
  args: BudgetedGenerateTextArgs
): Promise<string> {
  return runWithBudget<string>(
    {
      userId: args.userId,
      feature: args.feature,
      route: args.route,
      model: args.model,
      metadata: args.metadata,
      estimatedInputTokens: estimateTokens(args.systemPrompt, args.userPrompt),
      estimatedOutputTokens: args.maxOutputTokens ?? 900,
    },
    async (reservationId) => {
      const value = await routeTextGeneration(
        'chat',
        args.systemPrompt,
        args.userPrompt,
        0.7,
        args.maxOutputTokens ?? 2048,
        reservationId,
        args.model as any,
        true // skipCommit
      )

      return {
        value,
        model: args.model,
      }
    }
  )
}

export async function budgetedVisionCall(
  args: BudgetedVisionArgs
): Promise<string> {
  return runWithBudget<string>(
    {
      userId: args.userId,
      feature: args.feature,
      route: args.route,
      model: 'vision',
      metadata: args.metadata,
      estimatedInputTokens: estimateTokens(
        args.systemPrompt,
        args.userMessage,
        args.fileText
      ),
      estimatedOutputTokens: args.maxOutputTokens ?? 1200,
    },
    async (reservationId) => {
      // routeVisionCall doesn't take reservationId currently, so it won't commit internally
      const value = await routeVisionCall(
        args.systemPrompt,
        args.imageBase64 || '',
        args.imageMimeType || '',
        args.userMessage
      )

      return {
        value,
        model: 'vision',
      }
    }
  )
}

