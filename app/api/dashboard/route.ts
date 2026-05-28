import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCognitionData } from '@/lib/actions/cognition';
import { getRevisionData } from '@/lib/actions/revision';
import { getMistakeData } from '@/lib/actions/mistakes';
import { getPlanForDate } from '@/lib/actions/planner';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const today = new Date().toISOString().split('T')[0];

    const [profileRes, cognition, revision, mistakes, tasks] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      getCognitionData(),
      getRevisionData(),
      getMistakeData(),
      getPlanForDate(today),
    ]);

    return NextResponse.json({
      profile: profileRes.data,
      cognition,
      revision,
      mistakes,
      tasks: tasks || [],
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
