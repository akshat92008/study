import { CurriculumNode } from "./curriculum-templates";

export type Microtarget = {
  id: string;
  user_id: string;
  goal_id: string;
  curriculum_node_id?: string;
  title: string;
  description?: string;
  subject?: string | null;
  status: "pending" | "active" | "completed";
  order_index: number;
  source: string;
};

export async function seedMicrotargetsForGoal(params: {
  supabase: any;
  userId: string;
  goalId: string;
  curriculumNodes: CurriculumNode[];
  limit?: number;
}): Promise<Microtarget[]> {
  const { supabase, userId, goalId, curriculumNodes, limit = 5 } = params;

  // 1. Check if microtargets already exist for this goal
  // We check the seeded_topics table since it acts as our microtargets storage
  const { data: existing, error: fetchError } = await supabase
    .from('seeded_topics')
    .select('id')
    .eq('user_id', userId)
    .eq('goal_id', goalId)
    .limit(1);

  if (fetchError) {
    console.error("Failed to fetch existing microtargets:", fetchError);
    throw fetchError;
  }

  // Do not re-seed if we already have microtargets for this goal
  if (existing && existing.length > 0) {
    return [];
  }

  // 2. Select the top N curriculum nodes
  const nodesToSeed = curriculumNodes.slice(0, limit);
  if (nodesToSeed.length === 0) return [];

  // 3. Prepare rows for insertion into seeded_topics
  const rows = nodesToSeed.map((node, index) => {
    return {
      user_id: userId,
      goal_id: goalId,
      subject: node.subject || 'mixed',
      chapter: node.chapter || 'Foundations',
      topic: node.title,
      microtarget: node.description || `Master the concepts of ${node.title}`,
      order_index: index + 1,
      topic_slug: `topic-${goalId}-${index}`,
      microtarget_slug: `microtarget-${goalId}-${index}`,
      template_key: node.source,
      source: 'system_seeded',
      status: index === 0 ? 'active' : 'not_started',
      mastery_score: 0,
      confidence: 'low',
      metadata: {
        seededBy: 'microtarget-seeder-v2',
      },
    };
  });

  // 4. Insert rows
  const { data: inserted, error: upsertError } = await supabase
    .from('seeded_topics')
    .upsert(rows, {
      onConflict: 'user_id,goal_id,template_key,topic_slug,microtarget_slug',
    })
    .select('*');

  if (upsertError) {
    console.error("Failed to seed microtargets:", upsertError);
    throw upsertError;
  }

  // Map back to our abstract Microtarget type
  return (inserted || []).map((row: any) => ({
    id: row.id,
    user_id: row.user_id,
    goal_id: row.goal_id,
    title: row.topic,
    description: row.microtarget,
    subject: row.subject,
    status: row.status === 'not_started' ? 'pending' : row.status,
    order_index: row.order_index,
    source: row.source,
  }));
}
