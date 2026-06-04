import { TEMPLATES } from './templates/neet-physics';

export interface SeedTopicParams {
  userId: string;
  goalId: string;
  goalTitle: string;
  goalType: string;
  presetId?: string | null;
  subjects?: string[];
}

export async function seedTopicsForGoal(supabase: any, params: SeedTopicParams) {
  const { userId, goalId, goalTitle, presetId, subjects } = params;

  // Check if we already seeded for this goal
  const { count, error: countError } = await supabase
    .from('seeded_topics')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('goal_id', goalId);

  if (countError) {
    console.error('Failed to check existing seeded topics', countError);
    return;
  }

  if (count && count > 0) {
    console.log(`Topics already seeded for goal ${goalId}, skipping.`);
    return;
  }

  let templateKey = presetId?.toLowerCase();
  
  // Custom logic for neet physics kinematics based on title and preset
  if (
    (templateKey === 'neet_ug' || templateKey === 'neet') &&
    goalTitle.toLowerCase().includes('kinematics')
  ) {
    templateKey = 'neet_physics_kinematics';
  }

  let topicsToSeed: any[] = [];
  let source = 'custom_seed';

  if (templateKey && TEMPLATES[templateKey]) {
    const template = TEMPLATES[templateKey];
    source = 'seeded_template';
    topicsToSeed = template.topics.map((t: any) => ({
      user_id: userId,
      goal_id: goalId,
      subject: template.subject,
      chapter: template.chapter,
      topic: t.topic,
      microtarget: t.microtarget,
      template_key: templateKey,
      source,
    }));
  } else {
    // Fallback: Rule-generated subtopics
    const subject = subjects && subjects.length > 0 ? subjects[0] : 'General';
    const fallbackTopics = [
      'Core Fundamentals',
      'Key Definitions & Concepts',
      'Formulas & Properties',
      'Common Applications',
      'Advanced Problem Solving'
    ];
    templateKey = 'custom';
    topicsToSeed = fallbackTopics.map((t) => ({
      user_id: userId,
      goal_id: goalId,
      subject,
      chapter: goalTitle,
      topic: t,
      microtarget: `Understand ${t.toLowerCase()} for ${goalTitle}`,
      template_key: templateKey,
      source,
    }));
  }

  // Insert topics
  const { error: insertError } = await supabase
    .from('seeded_topics')
    .upsert(topicsToSeed, { 
      onConflict: 'user_id,goal_id,template_key,microtarget',
      ignoreDuplicates: true
    });

  if (insertError) {
    console.error('Failed to insert seeded topics', insertError);
  } else {
    console.log(`Successfully seeded ${topicsToSeed.length} topics for goal ${goalId}`);
  }
}
