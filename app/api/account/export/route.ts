import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const response = new NextResponse();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookiesToSet: any[]) => {
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tables = {
    profile: supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    goals: supabase.from('learning_goals').select('*').eq('user_id', user.id),
    sessions: supabase.from('study_sessions').select('*').eq('user_id', user.id),
    materials: supabase.from('study_materials').select('id, goal_id, title, status, error_message, last_error, created_at, updated_at').eq('user_id', user.id),
    practiceSets: supabase.from('practice_sets').select('*').eq('user_id', user.id),
    practiceAttempts: supabase.from('practice_attempts').select('*').eq('user_id', user.id),
    notes: supabase.from('saved_notes').select('*').eq('user_id', user.id),
    learnerEvents: supabase.from('learner_events').select('*').eq('user_id', user.id),
    concepts: supabase.from('concepts').select('*').eq('user_id', user.id),
    revisionCards: supabase.from('revision_cards').select('*').eq('user_id', user.id),
    mistakes: supabase.from('mistakes').select('*').eq('user_id', user.id),
    mistakeRetests: supabase.from('mistake_retests').select('*').eq('user_id', user.id),
    activity: supabase.from('agent_actions').select('*').eq('user_id', user.id),
    notifications: supabase.from('amaura_notifications').select('*').eq('user_id', user.id),
  };

  const entries = await Promise.all(Object.entries(tables).map(async ([key, query]) => {
    const result = await query;
    if (result.error) throw new Error(`Unable to export ${key}: ${result.error.message}`);
    return [key, result.data] as const;
  }));

  const exportData = {
    ...Object.fromEntries(entries),
    schemaVersion: 1,
    userId: user.id,
    exportedAt: new Date().toISOString()
  };

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="data-export-${user.id}.json"`
    }
  });
}
