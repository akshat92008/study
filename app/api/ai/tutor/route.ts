import { disabledForMvp } from '@/lib/api/disabled';

export async function GET() {
  // sourceType: 'tutor_chat'
  return disabledForMvp();
}

export async function POST() {
  return disabledForMvp();
}
