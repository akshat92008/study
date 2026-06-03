import { NextResponse } from 'next/server';
import { EventWorkerService } from '@/lib/events/worker';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const results: any[] = [];
    while (true) {
      const res = await EventWorkerService.processBatch(50, 10, 60_000, Date.now());
      results.push(res);
      if (res.processed === 0 && res.failed === 0 && res.skipped === 0) {
        break;
      }
    }
    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
