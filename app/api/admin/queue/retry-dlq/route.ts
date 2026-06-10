import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { retryDlqEvents } from '@/lib/events/retry';
import { logAdminAction } from '@/lib/admin/audit';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { user, error, status } = await requireAdmin();
  if (error) {
    return NextResponse.json({ error }, { status });
  }

  try {
    const result = await retryDlqEvents();
    if (user) {
      await logAdminAction(user.id, 'retry_queue', { retriedCount: result.recovered });
    }
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 200 });
  }
}
