import { Metadata } from 'next';
import QueueDashboard from './QueueDashboard';

export const metadata: Metadata = {
  title: 'Admin Queue Recovery | Cognition OS',
  description: 'Manual recovery panel for asynchronous event queues',
};

export default function AdminQueuePage() {
  return <QueueDashboard />;
}
