import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { validateCronRequest } from '@/lib/middleware/cronAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authError = validateCronRequest(req);
  if (authError) {
    return authError;
  }

  const supabase = createAdminClient();

  try {
    const { data: statusCounts, error } = await supabase
      .from('study_materials')
      .select('status')
      .in('status', ['pending', 'processing', 'failed', 'ready']);

    if (error) throw error;

    const stats = {
      pending: 0,
      processing: 0,
      failed: 0,
      ready: 0,
    };

    if (statusCounts) {
      for (const row of statusCounts) {
        if (row.status in stats) {
          stats[row.status as keyof typeof stats]++;
        }
      }
    }

    return NextResponse.json({
      status: 'ok',
      embeddings_status: 'online',
      materials: stats,
    });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', message: err.message }, { status: 500 });
  }
}
