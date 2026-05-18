import { getRevisionData } from '@/lib/actions/revision';
import RevisionDashboard from '@/components/revision/RevisionDashboard';

export default async function RevisionPage() {
  const data = await getRevisionData();
  return <RevisionDashboard data={data} />;
}
