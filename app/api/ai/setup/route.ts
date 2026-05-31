import { disabledForMvp } from '@/lib/api/disabled';

export async function POST() {
  return disabledForMvp();
}
