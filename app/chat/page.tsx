import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { GlobalChat } from '@/components/chat/GlobalChat';

export default async function ChatPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg-root)' }}>
      <GlobalChat />
    </main>
  );
}
