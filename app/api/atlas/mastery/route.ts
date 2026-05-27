import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSyllabusMastery } from '@/lib/services/atlasService';

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const mastery = await getSyllabusMastery(user.id);
  if (!mastery) return NextResponse.json({ error: 'No syllabus data' }, { status: 404 });

  return NextResponse.json(mastery);
}
