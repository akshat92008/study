import { getMistakeData } from '@/lib/actions/mistakes';
import MistakeDashboard from '@/components/mistakes/MistakeDashboard';

export default async function MistakesPage() {
  const data = await getMistakeData();
  return <MistakeDashboard data={data} />;
}
