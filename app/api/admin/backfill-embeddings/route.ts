import { NextResponse } from 'next/server';
import { disabledForMvp } from '@/lib/api/disabled';
import { requireAdmin } from '@/lib/auth/admin';

export async function POST() {
  const { error, status } = await requireAdmin();
  if (error) {
    return NextResponse.json({ error }, { status });
  }

  return disabledForMvp();
}
