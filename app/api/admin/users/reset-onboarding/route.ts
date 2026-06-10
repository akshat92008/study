import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { resetOnboarding } from '@/lib/admin/user-management';
import { readAdminUserRequest, requireTargetUserId } from '../_request';

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error || !auth.user) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const body = await readAdminUserRequest(req);
    await resetOnboarding(auth.user.id, requireTargetUserId(body));
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: 'admin_action_failed', message: error.message }, { status: 400 });
  }
}
