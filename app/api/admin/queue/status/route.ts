import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { EventWorkerService } from '@/lib/events/worker';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { error, status } = await requireAdmin();
  if (error) {
    return NextResponse.json({ error }, { status });
  }

  try {
    const summary = await EventWorkerService.getHealthSummary();
    return NextResponse.json(summary);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
