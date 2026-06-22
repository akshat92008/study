/**
 * Model Planner - LLM-based planning for the agent runtime.
 *
 * The model planner produces a JSON plan that selects tools from the registry.
 * It uses the app's configured AI provider, inheriting from existing config.
 *
 * If the model is unavailable or the plan is invalid, it falls back to
 * deterministic planning using buildAgentPlan.
 */
import type { z } from 'zod';
import { z as zod } from 'zod';
import { logger } from '@/lib/utils/logger';
import type { AgentChannel, AgentObservation, JsonObject, LearningSignal } from './types';
import { buildAgentPlan } from './planner';
import { generateJSON, MODELS } from '@/lib/ai/provider-client';

// Plan schema - must match what the model produces
export const ModelPlanSchema = zod.object({
  answer_intent: zod.string(),
  observations: zod.array(zod.object({
    type: zod.enum([
      'confusion', 'misconception', 'source_request', 'practice_result',
      'revision_need', 'session_completion', 'autopsy_mistake', 'general'
    ]),
    summary: zod.string(),
    confidence: zod.number().min(0).max(1),
  })).default([]),
  learning_signals: zod.array(zod.object({
    signal_type: zod.enum([
      'weak_area_detected', 'misconception_detected', 'concept_understood',
      'source_used', 'revision_needed', 'practice_needed',
      'explanation_generated', 'session_should_adapt'
    ]),
    concept_name: zod.string().nullable(),
    confidence: zod.number().min(0).max(1),
    evidence: zod.string(),
  })).default([]),
  required_tools: zod.array(zod.object({
    tool_name: zod.string(),
    reason: zod.string(),
    input: zod.record(zod.unknown()),
    priority: zod.number().min(1).max(10),
    expected_mutation: zod.boolean(),
  })).default([]),
  expected_mutations: zod.array(zod.object({
    entity_type: zod.string(),
    action: zod.string(),
    reason: zod.string(),
  })).default([]),
  risk_flags: zod.array(zod.string()).default([]),
  should_continue_after_tools: zod.boolean(),
  final_response_instruction: zod.string(),
  confidence: zod.number().min(0).max(1),
});

type ModelPlanType = z.infer<typeof ModelPlanSchema>;

export type ModelPlan = ModelPlanType;

export interface AgentPlanOutput {
  answer_intent: string;
  observations: Array<{ type: string; summary: string; confidence: number }>;
  learning_signals: LearningSignal[];
  required_tools: Array<{ name: string; input: JsonObject }>;
  expected_mutations: string[];
  pedagogical_next_step: JsonObject;
  confidence: number;
  risk_flags: string[];
  plan_source: 'model' | 'deterministic';
  final_response_instruction?: string;
}

interface ModelPlannerInput {
  channel: AgentChannel;
  observation: AgentObservation; // Fix 6: Pass real observation
  userMessage?: string;
  payload?: JsonObject;
  contextSummary?: JsonObject;
  sourceChunks?: JsonObject[];
  learningSignals?: LearningSignal[];
  skills?: JsonObject[];
  allowedToolNames?: string[];
}

const TOOL_PROMPTS: Record<string, string> = {
  get_learner_context: 'get_learner_context - Load learner profile, goal, mission, ATLAS concepts, MEMORY cards, and sources',
  retrieve_source_chunks: 'retrieve_source_chunks - Fetch relevant source chunks for a topic',
  extract_learning_signals: 'extract_learning_signals - Analyze message for learning signals',
  diagnose_weak_areas: 'diagnose_weak_areas - Infer related weak concepts',
  update_microtarget: 'update_microtarget - Update daily microtarget progress',
  write_learning_event: 'write_learning_event - Log a learning event',
  apply_practice_attempt: 'apply_practice_attempt - Process a practice attempt',
  complete_session: 'complete_session - Complete a study session',
  adapt_daily_plan: 'adapt_daily_plan - Adapt the daily learning plan',
  record_autopsy_mistake: 'record_autopsy_mistake - Record a mistake from autopsy',
  verify_weak_area_state: 'verify_weak_area_state - Verify ATLAS/MEMORY state',
  read_trajectory_context: 'read_trajectory_context - Load recent trajectory context',
  create_agent_skill: 'create_agent_skill - Create a durable agent skill',
  mark_skill_used: 'mark_skill_used - Mark a skill as used',
  propose_next_action: 'propose_next_action - Propose next learning action',
};

function payloadSummary(channel: AgentChannel, payload?: JsonObject): string {
  if (!payload) return '(no payload)';
  
  // Fix 5: Include specific payload details for critical channels
  switch (channel) {
    case 'practice':
      return `Practice: SetId=${payload.practiceSetId}, Correct=${(payload.metrics as any)?.correctCount}, Wrong=${(payload.metrics as any)?.wrongCount}, Items=${(payload.items as any[])?.length || 0}`;
    case 'session':
      return `Session: SessionId=${payload.sessionId}, Concept=${payload.conceptName}, Subject=${payload.subject}, Understood=${payload.understood}`;
    case 'autopsy':
      return `Autopsy: ReportId=${payload.reportId}, HighRisk=${payload.highRiskTopics}, Patterns=${payload.repeatedPatterns}, Source=${payload.source}`;
    case 'background':
      return `Background: DueCards=${payload.dueCardCount}, WeakConcepts=${payload.weakConcepts}`;
    default:
      return JSON.stringify(payload).slice(0, 300);
  }
}

function buildPlanningPrompt(input: ModelPlannerInput): string {
  const channel = input.channel;
  const tools = Object.entries(TOOL_PROMPTS)
    .filter(([name]) => !input.allowedToolNames || input.allowedToolNames.includes(name))
    .map(([name, desc]) => `  - ${desc}`)
    .join('\n');

  const signalList = input.learningSignals
    ?.map(s => `  - [${s.type}] ${s.concept ?? 'unspecified'}: ${s.evidence ?? ''}`)
    .join('\n') ?? '  None detected yet';

  const skillList = input.skills
    ?.map((s: any) => `  - ${s.name}: ${s.description}`)
    .join('\n') ?? '  None active';

  const chunkInfo = input.sourceChunks?.length
    ? `${input.sourceChunks.length} source chunk(s) retrieved`
    : 'No source chunks retrieved';

  return `You are a learning agent planning the next actions for a student in a personalized learning platform (Cognition OS).

## Current Context
- Channel: ${channel}
- User message: ${input.userMessage?.slice(0, 500) ?? '(no message)'}
- Payload Summary: ${payloadSummary(channel, input.payload)}
- Source chunks: ${chunkInfo}
- ${input.contextSummary ? JSON.stringify(input.contextSummary).slice(0, 700) : 'Context not yet loaded'}

## Active Learning Signals (from this turn)
${signalList}

## Relevant Skills (if any)
${skillList}

## Available Tools
You may ONLY choose from this list:
${tools}

## Task
Based on the context above, produce a JSON plan with:
1. "answer_intent": What the response should accomplish
2. "observations": What you observed about the user's state
3. "learning_signals": Learning signal types and concepts detected
4. "required_tools": List of tools to call (MUST be from the allowed list above)
5. "expected_mutations": What state changes will result
6. "risk_flags": Any concerns about the plan
7. "should_continue_after_tools": Whether to continue after tool calls
8. "final_response_instruction": Instruction for the final response
9. "confidence": High (0.8+) if confident about plan, lower if uncertain

## Rules
- Only use tools from the allowed list above
- For mutating tools, confidence must be 0.65+
- Do not invent tool names or state changes not supported
- If source was requested but not retrieved, flag risk_flags
- Output ONLY valid JSON - no markdown, no explanation

Respond with a JSON object matching this schema:
{
  "answer_intent": string,
  "observations": [{type, summary, confidence}],
  "learning_signals": [{signal_type, concept_name, confidence, evidence}],
  "required_tools": [{tool_name, reason, input, priority, expected_mutation}],
  "expected_mutations": [{entity_type, action, reason}],
  "risk_flags": string[],
  "should_continue_after_tools": boolean,
  "final_response_instruction": string,
  "confidence": number
}`;
}

async function callModelForPlan(
  prompt: string,
  modelTier?: 'fast' | 'strong'
): Promise<string> {
  try {
    // Use the 'flash' model for fast planning (fast tier) or 'pro' for stronger
    const modelKey = modelTier === 'strong' ? 'pro' : 'flash';

    const result = await generateJSON(
      modelKey,
      'You are a JSON-only planner. Output ONLY valid JSON, no markdown or explanation.',
      prompt,
      ModelPlanSchema,
      0.3
    );

    return JSON.stringify(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn('Model planning failed, will use deterministic fallback', { error: message });
    throw error;
  }
}

async function repairPlan(
  prompt: string,
  errors: string[],
  attemptNumber: number
): Promise<ModelPlan | null> {
  const repairPrompt = `${prompt}\n\n## Validation Errors
Your previous plan had these errors:
${errors.map(e => `- ${e}`).join('\n')}

Please fix these and output ONLY valid JSON.`;

  try {
    const result = await callModelForPlan(repairPrompt, 'fast');
    return JSON.parse(result) as ModelPlan;
  } catch {
    logger.warn(`Plan repair attempt ${attemptNumber} failed`);
    return null;
  }
}

/**
 * Build a plan using the model, with fallback to deterministic planning.
 */
export async function buildModelPlan(input: ModelPlannerInput): Promise<AgentPlanOutput> {
  const prompt = buildPlanningPrompt(input);
  const maxRetries = 1;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const rawResult = await callModelForPlan(prompt, 'fast');
      const parsed = ModelPlanSchema.safeParse(JSON.parse(rawResult));

      if (parsed.success) {
        const plan = parsed.data;
        logger.info('Model plan generated', {
          channel: input.channel,
          toolCount: plan.required_tools.length,
          confidence: plan.confidence,
        });

        return {
          answer_intent: plan.answer_intent,
          observations: plan.observations,
          learning_signals: plan.learning_signals.map((ls: any) => ({
            type: ls.signal_type,
            concept: ls.concept_name ?? null,
            confidence: ls.confidence,
            evidence: ls.evidence,
          })),
          required_tools: plan.required_tools.map((t: any) => ({
            name: t.tool_name,
            input: t.input,
          })),
          expected_mutations: plan.expected_mutations.map((m: any) => `${m.entity_type}:${m.action}`),
          pedagogical_next_step: {
            type: plan.should_continue_after_tools ? 'continue' : 'final',
            risk_flags: plan.risk_flags,
          },
          confidence: plan.confidence,
          risk_flags: plan.risk_flags,
          plan_source: 'model',
          final_response_instruction: plan.final_response_instruction,
        };
      } else {
        const errors = parsed.error.issues.map((i: any) => `${i.path.join('.')}: ${i.message}`);
        logger.warn('Model plan validation failed', { errors, attempt });

        if (attempt === 0) {
          const repaired = await repairPlan(prompt, errors, attempt + 1);
          if (repaired) {
            const recheck = ModelPlanSchema.safeParse(repaired);
            if (recheck.success) {
              const plan = recheck.data;
              return {
                answer_intent: plan.answer_intent,
                observations: plan.observations,
                learning_signals: plan.learning_signals.map((ls: any) => ({
                  type: ls.signal_type,
                  concept: ls.concept_name ?? null,
                  confidence: ls.confidence,
                  evidence: ls.evidence,
                })),
                required_tools: plan.required_tools.map((t: any) => ({
                  name: t.tool_name,
                  input: t.input,
                })),
                expected_mutations: plan.expected_mutations.map((m: any) => `${m.entity_type}:${m.action}`),
                pedagogical_next_step: {
                  type: plan.should_continue_after_tools ? 'continue' : 'final',
                  risk_flags: plan.risk_flags,
                },
                confidence: plan.confidence,
                risk_flags: plan.risk_flags,
                plan_source: 'model',
                final_response_instruction: plan.final_response_instruction,
              };
            }
          }
        }

        logger.info('Model planning failed validation, using deterministic fallback');
        break;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(`Model planning attempt ${attempt + 1} failed: ${message}`);
      if (attempt === maxRetries) {
        logger.info('Model planning exhausted, using deterministic fallback');
        break;
      }
    }
  }

  // Fallback to deterministic planning
  logger.info('Using deterministic fallback plan', { channel: input.channel });
  const deterministicPlan = buildAgentPlan({
    observation: input.observation,
    signals: input.learningSignals ?? [],
    sourceChunks: (input.sourceChunks ?? []) as any[],
  });

  return {
    answer_intent: deterministicPlan.answer_intent,
    observations: [],
    learning_signals: deterministicPlan.learning_signals,
    required_tools: deterministicPlan.required_tools.map((t) => ({ name: t.name, input: t.input })),
    expected_mutations: deterministicPlan.expected_mutations,
    pedagogical_next_step: deterministicPlan.pedagogical_next_step,
    confidence: deterministicPlan.confidence,
    risk_flags: deterministicPlan.risk_flags,
    plan_source: 'deterministic',
  };
}

/**
 * Validate that required tools in a plan exist in the registry
 */
export function validatePlanTools(plan: AgentPlanOutput, allowedToolNames: Set<string>): { valid: boolean; invalidTools: string[] } {
  const invalidTools: string[] = [];

  for (const tool of plan.required_tools) {
    if (!allowedToolNames.has(tool.name)) {
      invalidTools.push(tool.name);
    }
  }

  return {
    valid: invalidTools.length === 0,
    invalidTools,
  };
}
