import { disabledForMvp } from '@/lib/api/disabled';

export async function GET() {
  return disabledForMvp();
}
