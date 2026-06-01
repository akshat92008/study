import { logger } from '@/lib/utils/logger';

export type DailyMicrotaskStatus = 'pending' | 'done' | 'skipped';

export type DailyMicrotask = {
  id: string;
  user_id: string;
  session_card_id?: string | null;
  task_date: string;
  title: string;
  subject?: string | null;
  topic?: string | null;
  concept_id?: string | null;
  type: string;
  estimated_minutes: number;
  target_count?: number | null;
  status: DailyMicrotaskStatus;
  priority: string;
  source: string;
  created_at: string;
  completed_at?: string | null;
};

export class DailyMicrotaskService {
  constructor(private supabase: any) {}

  async getMicrotasksForDate(userId: string, date: string): Promise<DailyMicrotask[]> {
    const { data, error } = await this.supabase
      .from('daily_microtasks')
      .select('*')
      .eq('user_id', userId)
      .eq('task_date', date)
      .order('created_at', { ascending: true });

    if (error) {
      logger.error('Failed to get microtasks', { userId, date, error: error.message });
      throw new Error('Could not fetch daily microtasks.');
    }
    return data ?? [];
  }

  async addMicrotask(task: Omit<DailyMicrotask, 'id' | 'created_at' | 'completed_at'>): Promise<DailyMicrotask> {
    const { data, error } = await this.supabase
      .from('daily_microtasks')
      .insert(task)
      .select('*')
      .single();

    if (error) {
      logger.error('Failed to add microtask', { userId: task.user_id, error: error.message });
      throw new Error('Could not add microtask.');
    }
    return data;
  }

  async updateMicrotaskStatus(id: string, userId: string, status: DailyMicrotaskStatus): Promise<DailyMicrotask> {
    const payload: Partial<DailyMicrotask> = {
      status,
      completed_at: status === 'done' ? new Date().toISOString() : null,
    };

    const { data, error } = await this.supabase
      .from('daily_microtasks')
      .update(payload)
      .eq('id', id)
      .eq('user_id', userId)
      .select('*')
      .single();

    if (error) {
      logger.error('Failed to update microtask status', { id, userId, error: error.message });
      throw new Error('Could not update microtask.');
    }
    return data;
  }

  async deleteMicrotask(id: string, userId: string): Promise<void> {
    const { error } = await this.supabase
      .from('daily_microtasks')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      logger.error('Failed to delete microtask', { id, userId, error: error.message });
      throw new Error('Could not delete microtask.');
    }
  }

  async replaceMicrotasks(userId: string, date: string, tasks: Omit<DailyMicrotask, 'id' | 'created_at' | 'completed_at'>[]): Promise<DailyMicrotask[]> {
    // Soft-delete or hard-delete existing ones? Let's just delete pending tasks to replace the plan.
    const { error: deleteError } = await this.supabase
      .from('daily_microtasks')
      .delete()
      .eq('user_id', userId)
      .eq('task_date', date)
      .eq('status', 'pending');

    if (deleteError) {
      logger.error('Failed to clear pending microtasks', { userId, date, error: deleteError.message });
    }

    if (tasks.length === 0) return [];

    const { data, error } = await this.supabase
      .from('daily_microtasks')
      .insert(tasks)
      .select('*');

    if (error) {
      logger.error('Failed to insert new microtasks', { userId, error: error.message });
      throw new Error('Could not replace microtasks.');
    }
    return data ?? [];
  }
}
