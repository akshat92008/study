import {
  createNotificationForUser,
  type AmauraNotificationInput,
} from '@/lib/amaura/agents/repositories';
import { createAdminClient } from '@/lib/supabase/admin';

type SupabaseLike = {
  from: (table: string) => any;
};

type RepositoryOptions = {
  client?: SupabaseLike;
};

export async function createNotification(
  input: AmauraNotificationInput & { userId: string },
  options: RepositoryOptions = {}
) {
  const { userId, ...notification } = input;
  return createNotificationForUser(userId, notification, options as any);
}

export async function createNotificationIfNotExists(
  input: AmauraNotificationInput & { userId: string; dedupKey: string },
  options: RepositoryOptions = {}
) {
  return createNotification(input, options);
}

export async function listUnreadNotifications(userId: string, options: RepositoryOptions = {}) {
  const supabase = options.client ?? createAdminClient();
  const { data, error } = await supabase
    .from('amaura_notifications')
    .select('*')
    .eq('user_id', userId)
    .eq('read', false)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw error;
  return data ?? [];
}

export async function markNotificationRead(
  userId: string,
  notificationId: string,
  options: RepositoryOptions = {}
) {
  const supabase = options.client ?? createAdminClient();
  const { data, error } = await supabase
    .from('amaura_notifications')
    .update({ read: true, updated_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}
