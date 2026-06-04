import { z } from 'zod';
import { getOrCreatePrimaryGoalSession, GOAL_SELECT } from '@/lib/services/goal-context.service';
import { seedTopicsForGoal } from '@/lib/topic-seeding';

const SubjectSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[\p{L}\p{N}\s&.,()/_+-]+$/u);

export const OnboardingCompletionSchema = z.object({
  fullName: z.string().trim().max(120).optional(),
  goalTitle: z.string().trim().min(1, 'Learning goal title is required.').max(160),
  goalType: z.string().trim().min(1).max(80).default('Custom Goal'),
  targetDate: z.string().trim().optional().nullable(),
  targetScore: z.coerce.number().finite().positive().optional().nullable(),
  dailyHours: z.coerce.number().finite().min(0.25).max(16).default(4),
  currentLevel: z.enum(['beginner', 'intermediate', 'advanced']).default('intermediate'),
  subjects: z.array(SubjectSchema).max(20).default([]),
  timezone: z.string().trim().max(80).optional().nullable(),
  presetId: z.string().trim().max(80).optional().nullable(),
});

export type OnboardingCompletionInput = z.input<typeof OnboardingCompletionSchema>;
export type OnboardingCompletion = z.infer<typeof OnboardingCompletionSchema>;

export function sanitizeSubjectList(value: unknown): string[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];

  const seen = new Set<string>();
  const subjects: string[] = [];

  for (const item of raw) {
    const subject = String(item ?? '').trim().replace(/\s+/g, ' ');
    const parsed = SubjectSchema.safeParse(subject);
    if (!parsed.success) continue;
    const key = parsed.data.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    subjects.push(parsed.data);
  }

  return subjects.slice(0, 20);
}

export function normalizeTimezone(value: string | null | undefined): string {
  const fallback = 'UTC';
  const timezone = value?.trim();
  if (!timezone) return fallback;

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
    return timezone;
  } catch {
    return fallback;
  }
}

export function normalizeTargetDate(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const date = new Date(`${raw}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : raw;
}

export async function completeOnboardingForUser({
  supabase,
  user,
  input,
}: {
  supabase: any;
  user: { id: string; email?: string | null; user_metadata?: Record<string, any> | null };
  input: OnboardingCompletionInput;
}) {
  const parsed = OnboardingCompletionSchema.parse({
    ...input,
    subjects: sanitizeSubjectList(input.subjects),
    timezone: normalizeTimezone(input.timezone),
    targetDate: normalizeTargetDate(input.targetDate),
  });

  const now = new Date().toISOString();
  const fullName = parsed.fullName || user.user_metadata?.full_name || user.email || 'Learner';
  const targetDate = normalizeTargetDate(parsed.targetDate);
  const timezone = normalizeTimezone(parsed.timezone);
  const primarySubject = parsed.subjects[0] ?? null;

  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id: user.id,
      email: user.email ?? '',
      full_name: fullName,
      exam_type: parsed.goalType,
      goal_type: parsed.goalType,
      target_date: targetDate,
      target_score: parsed.targetScore ?? null,
      daily_hours_available: parsed.dailyHours,
      daily_hours: parsed.dailyHours,
      subjects: parsed.subjects,
      current_level: parsed.currentLevel,
      timezone,
      onboarding_complete: true,
      updated_at: now,
    }, { onConflict: 'id' });

  if (profileError) {
    throw new Error(`Failed to save learner profile: ${profileError.message}`);
  }

  const existingGoal = await loadExistingActiveGoal(supabase, user.id);
  const goalPayload = {
    user_id: user.id,
    title: parsed.goalTitle,
    subject: primarySubject,
    domain: parsed.goalType,
    exam_type: parsed.goalType,
    goal_type: parsed.goalType,
    preset_id: parsed.presetId ?? presetIdForGoalType(parsed.goalType),
    target_level: parsed.currentLevel,
    description: `Primary onboarding goal for ${parsed.goalType}.`,
    target_date: targetDate,
    progress: existingGoal?.progress ?? 0,
    status: 'active',
    last_active_at: now,
    metadata: {
      ...(existingGoal?.metadata ?? {}),
      source: 'onboarding',
      subjects: parsed.subjects,
      dailyHours: parsed.dailyHours,
      currentLevel: parsed.currentLevel,
      timezone,
    },
    updated_at: now,
  };

  let goal;
  if (existingGoal?.id) {
    const { data, error } = await supabase
      .from('learning_goals')
      .update(goalPayload)
      .eq('id', existingGoal.id)
      .eq('user_id', user.id)
      .select(GOAL_SELECT)
      .single();
    if (error || !data) throw new Error(`Failed to update learning goal: ${error?.message ?? 'missing goal'}`);
    goal = data;
  } else {
    const { data, error } = await supabase
      .from('learning_goals')
      .insert(goalPayload)
      .select(GOAL_SELECT)
      .single();
    if (error || !data) throw new Error(`Failed to create learning goal: ${error?.message ?? 'missing goal'}`);
    goal = data;
  }

  const session = await getOrCreatePrimaryGoalSession(supabase, user.id, goal.id);

  // Seed topics deterministically or fallback to AI
  let topicSeeding: any = null;
  try {
    topicSeeding = await seedTopicsForGoal(supabase, {
      userId: user.id,
      goalId: goal.id,
      goalTitle: goal.title ?? input.goalTitle ?? 'Custom Goal',
      goalType: input.goalType ?? null,
      presetId: goal.preset_id ?? input.presetId ?? null,
      subject: input.subjects?.[0] ?? null,
      subjects: Array.isArray(input.subjects) ? input.subjects : [],
      chapter: null,
      targetDate: input.targetDate ?? null,
    });
  } catch (error) {
    console.warn('Onboarding topic seeding skipped', {
      userId: user.id,
      goalId: goal.id,
      error,
    });
  }

  return {
    profile: {
      id: user.id,
      onboardingComplete: true,
      goalType: parsed.goalType,
      timezone,
    },
    goal,
    session,
    createdGoal: !existingGoal,
    topicSeeding,
  };
}

async function loadExistingActiveGoal(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from('learning_goals')
    .select(GOAL_SELECT)
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('last_active_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Failed to load existing learning goal: ${error.message}`);
  return data ?? null;
}

function presetIdForGoalType(goalType: string): string {
  const value = goalType.toLowerCase();
  if (value.includes('neet')) return 'neet_ug';
  if (value.includes('jee')) return 'jee_main';
  if (value.includes('sat')) return 'sat';
  if (value.includes('mcat')) return 'mcat';
  if (value.includes('usmle')) return 'usmle';
  if (value.includes('coding') || value.includes('programming')) return 'coding_skill';
  return 'custom_learning_goal';
}
