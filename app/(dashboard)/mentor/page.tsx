import { createClient } from '@/lib/supabase/server';
import MentorChat from '@/components/mentor/MentorChat';

export default async function MentorPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: history } = await supabase
    .from('mentor_chats')
    .select('role, content, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(50);

  return <MentorChat initialHistory={history ?? []} />;
}
