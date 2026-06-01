import MentorChat from '@/components/mentor/MentorChat';
import { createClient } from '@/lib/supabase/server';
import { getOrCreateChatSession, loadRecentMessagesForClient } from '@/lib/services/chat-persistence';

export default async function MentorPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <MentorChat initialHistory={[]} />;

  const sessionId = await getOrCreateChatSession(supabase, user.id, 'mentor', 'AI Mentor');
  const messages = await loadRecentMessagesForClient(supabase, sessionId);
  return <MentorChat initialHistory={messages} />;
}
