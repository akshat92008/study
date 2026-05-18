import { getCognitionData, initializeConcepts } from '@/lib/actions/cognition';
import CognitionDashboard from '@/components/cognition/CognitionDashboard';

export default async function CognitionPage() {
  // Auto-seed concepts if needed
  await initializeConcepts();
  const data = await getCognitionData();

  return <CognitionDashboard data={data} />;
}
