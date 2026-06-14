// import 'server-only'

import {
  routeJSONGeneration,
  routeTextGeneration,
  routeStreamGeneration,
  routeVisionCall,
  routeMultimodalJSONExtraction,
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

type BudgetedGenerateMultimodalJSONArgs<TSchema = unknown> = BudgetedBase & {
  model: AIModelTier
  systemPrompt: string
  fileData: { mimeType: string, data: string }
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

type BudgetedStreamArgs = BudgetedBase & {
  model: AIModelTier
  systemPrompt: string
  userPrompt: string | Array<{ role: string; content: string }>
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
        true, // skipCommit since runWithBudget handles it
        args.userId
      )

      return {
        value,
        model: args.model,
      }
    }
  )
}

export async function budgetedGenerateMultimodalJSON<T = unknown>(
  args: BudgetedGenerateMultimodalJSONArgs<any>
): Promise<T> {
  return runWithBudget<T>(
    {
      userId: args.userId,
      feature: args.feature,
      route: args.route,
      model: args.model,
      metadata: args.metadata,
      estimatedInputTokens: estimateTokens(args.systemPrompt, args.fileData.data),
      estimatedOutputTokens: args.maxOutputTokens ?? 900,
    },
    async (reservationId) => {
      const value = await routeMultimodalJSONExtraction<T>(
        args.systemPrompt,
        args.fileData,
        args.schema
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
        true, // skipCommit
        args.userId
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

export async function budgetedStreamGeneration(
  args: BudgetedStreamArgs
): Promise<AsyncGenerator<string>> {
  const estimatedInput = estimateTokens(
    args.systemPrompt,
    typeof args.userPrompt === 'string' ? args.userPrompt : args.userPrompt.map(m => m.content).join('\n')
  )
  const estimatedOutput = args.maxOutputTokens ?? 1200

  const reservation = await reserveBudgetForModelCall(
    args.userId,
    args.feature,
    args.model,
    estimatedInput,
    estimatedOutput
  )

  return (async function* () {
    let budgetSettled = false

    try {
      const generator = routeStreamGeneration(
        args.systemPrompt,
        args.userPrompt,
        0.7,
        reservation.reservationId,
        args.model === 'flash' ? 'fast' : 'quality',
        true, // skipCommit
        args.userId
      )

      let totalChars = 0
      let fullResponseBuffer = ''
      for await (const chunk of generator) {
        totalChars += chunk.length
        fullResponseBuffer += chunk
        yield chunk
      }

      const isDegraded = fullResponseBuffer.includes('temporarily unavailable') || 
                         fullResponseBuffer.includes('at capacity') || 
                         fullResponseBuffer.includes('catching up with demand') ||
                         fullResponseBuffer.includes('I could not generate that part right now') ||
                         fullResponseBuffer.includes('temporarily paused');

      if (!isDegraded) {
        await commitBudgetUsage(reservation.reservationId, {
          promptTokens: estimatedInput,
          completionTokens: Math.ceil(totalChars / 4),
          route: args.route,
        })
      } else {
        await releaseBudgetReservation(reservation.reservationId, 'degraded_response').catch(() => null)
      }
      budgetSettled = true

    } catch (error) {
      if (!budgetSettled) {
        await releaseBudgetReservation(reservation.reservationId, error instanceof Error ? error.message : 'unknown_error').catch(() => null)
      }
      throw error
    }
  })()
}
