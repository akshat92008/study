import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return { user: null, error: 'Unauthorized', status: 401 };
  }

  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);
  const adminUserIds = (process.env.ADMIN_USER_IDS || '').split(',').map(e => e.trim()).filter(Boolean);

  const isEmailAdmin = user.email && adminEmails.includes(user.email);
  const isIdAdmin = adminUserIds.includes(user.id);

  if (!isEmailAdmin && !isIdAdmin) {
    return { user, error: 'Forbidden', status: 403 };
  }

  return { user, error: null, status: 200 };
}

export function isUnlimitedUser(userId: string | null | undefined): boolean {
  if (!userId) return false;
  if (process.env.NODE_ENV === 'production') return false;
  const adminIds = (process.env.ADMIN_USER_IDS || '').split(',').map(e => e.trim()).filter(Boolean);
  const testIds = (process.env.TEST_ACCOUNT_USER_IDS || '').split(',').map(e => e.trim()).filter(Boolean);
  return adminIds.includes(userId) || testIds.includes(userId);
}

export async function requireAdminServer() {
  return requireAdmin();
}
