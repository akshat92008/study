import { createClient } from '@/lib/supabase/server';
import TutorChat from '@/components/tutor/TutorChat';

export default async function TutorPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: concepts } = await supabase
    .from('concepts')
    .select('subject, chapter')
    .eq('user_id', user.id);

  return <TutorChat concepts={concepts || []} />;
}
