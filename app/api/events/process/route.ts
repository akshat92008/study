import { NextRequest } from 'next/server';
import { EventWorkerService } from '@/lib/events/worker';
import { validateCronRequest } from '@/lib/middleware/cronAuth';

export async function POST(req: NextRequest) {
  const authError = validateCronRequest(req);
  if (authError) return authError;

  try {
    const processedCount = await EventWorkerService.processBatch(50, 5);
    return Response.json({ success: true, processed_count: processedCount });
  } catch (err: any) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}
