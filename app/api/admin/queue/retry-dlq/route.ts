import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { retryDlqEvents } from '@/lib/events/retry';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { error, status } = await requireAdmin();
  if (error) {
    return NextResponse.json({ error }, { status });
  }

  try {
    const result = await retryDlqEvents();
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 200 });
  }
}
