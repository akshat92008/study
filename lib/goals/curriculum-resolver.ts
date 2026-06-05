import { z } from "zod";
import { generateJSON, generateText } from "@/lib/ai/provider-client";
import { GoalDomain, inferGoalDomain } from "./goal-domain";
import { CurriculumNode, findCurriculumTemplate } from "./curriculum-templates";

export type ResolvedCurriculum = {
  goalDomain: GoalDomain;
  nodes: CurriculumNode[];
  source: "template" | "ai_generated" | "fallback";
  confidence: number;
  clarificationQuestion?: string;
};

const GeneratedNodeSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  unit: z.string().optional(),
  chapter: z.string().optional(),
  estimatedMinutes: z.number().optional(),
});

const GeneratedRoadmapSchema = z.object({
  nodes: z.array(GeneratedNodeSchema).min(3).max(12),
});

// Cache for AI-generated roadmaps to avoid repeated LLM calls for identical goals
const aiRoadmapCache = new Map<string, CurriculumNode[]>();

export async function resolveCurriculumForGoal(goalTitle: string): Promise<ResolvedCurriculum> {
  const domain = inferGoalDomain(goalTitle);

  if (domain.needsClarification) {
    return {
      goalDomain: domain,
      nodes: [],
      source: "fallback",
      confidence: domain.confidence,
      clarificationQuestion: domain.clarificationQuestion,
    };
  }

  const template = findCurriculumTemplate(domain);
  if (template) {
    return {
      goalDomain: domain,
      nodes: template.nodes.map(n => ({ ...n, subject: domain.subject || n.subject })),
      source: "template",
      confidence: 1.0,
    };
  }

  // AI Generation
  const cacheKey = domain.normalizedGoal;
  if (aiRoadmapCache.has(cacheKey)) {
    return {
      goalDomain: domain,
      nodes: aiRoadmapCache.get(cacheKey)!,
      source: "ai_generated",
      confidence: 0.8,
    };
  }

  let aiNodes: CurriculumNode[] | null = null;
  const systemPrompt = `You are an expert curriculum designer. 
Create a highly structured, step-by-step learning roadmap for a student whose goal is: "${domain.rawGoal}".
Generate 5 to 12 starter nodes. Keep titles concise and actionable.
Output STRICT JSON matching the schema. No markdown, no explanations.`;
  
  const userPrompt = `Goal: ${domain.rawGoal}\nSubject: ${domain.subject || 'unknown'}\nExam: ${domain.exam || 'none'}\nGenerate the starter curriculum nodes.`;

  try {
    const aiResult = await generateJSON("flash", systemPrompt, userPrompt, GeneratedRoadmapSchema, 0.3);
    
    if (aiResult && aiResult.nodes && Array.isArray(aiResult.nodes) && aiResult.nodes.length >= 3) {
      aiNodes = aiResult.nodes.map((n, i) => ({
        ...n,
        orderIndex: i + 1,
        source: "ai_generated" as const,
        subject: domain.subject,
      }));
    }
  } catch (error) {
    console.error("AI Curriculum Generation failed:", error);
    
    // Retry with text generation if JSON fails
    try {
        const textResult = await generateText("flash", systemPrompt + "\nOUTPUT ONLY VALID JSON. NOTHING ELSE.", userPrompt, 0.3);
        const parsed = JSON.parse(textResult.replace(/```json/g, "").replace(/```/g, ""));
        const parsedNodes = GeneratedRoadmapSchema.parse(parsed);
        aiNodes = parsedNodes.nodes.map((n, i) => ({
            ...n,
            orderIndex: i + 1,
            source: "ai_generated" as const,
            subject: domain.subject,
        }));
    } catch (retryError) {
        console.error("AI Curriculum Generation retry failed:", retryError);
    }
  }

  if (aiNodes) {
    aiRoadmapCache.set(cacheKey, aiNodes);
    return {
      goalDomain: domain,
      nodes: aiNodes,
      source: "ai_generated",
      confidence: 0.8,
    };
  }

  // Generic Fallback
  const fallbackSubject = domain.subject || domain.exam || domain.rawGoal;
  const fallbackNodes: CurriculumNode[] = [
    { orderIndex: 1, title: `Understand the foundations of ${fallbackSubject}`, source: "fallback", subject: domain.subject },
    { orderIndex: 2, title: `Build your topic map for ${fallbackSubject}`, source: "fallback", subject: domain.subject },
    { orderIndex: 3, title: `Upload your first source for ${fallbackSubject}`, source: "fallback", subject: domain.subject },
    { orderIndex: 4, title: `Take a diagnostic check`, source: "fallback", subject: domain.subject },
    { orderIndex: 5, title: `Start your first review loop`, source: "fallback", subject: domain.subject },
  ];

  return {
    goalDomain: domain,
    nodes: fallbackNodes,
    source: "fallback",
    confidence: 0.3,
  };
}

export async function saveCurriculumNodes(
  supabase: any,
  userId: string,
  goalId: string,
  domain: GoalDomain,
  nodes: CurriculumNode[]
) {
  const rows = nodes.map(node => ({
    user_id: userId,
    goal_id: goalId,
    title: node.title,
    description: node.description || null,
    subject: node.subject || domain.subject || null,
    domain: domain.domain,
    unit: node.unit || null,
    chapter: node.chapter || null,
    order_index: node.orderIndex,
    estimated_minutes: node.estimatedMinutes || null,
    status: 'not_started',
    source: node.source,
  }));

  if (rows.length === 0) return [];

  const { data, error } = await supabase
    .from('goal_curriculum_nodes')
    .insert(rows)
    .select('*');

  if (error) {
    console.error("Failed to save curriculum nodes:", error);
    throw error;
  }

  return data;
}

