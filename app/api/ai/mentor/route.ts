import { disabledForMvp } from '@/lib/api/disabled';

export async function GET() {
  // sourceType: 'mentor_chat'
  return disabledForMvp();
}

export async function POST() {
  return disabledForMvp();
}
