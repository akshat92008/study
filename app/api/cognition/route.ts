import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCognitionGraph } from '@/lib/engines/cognition-graph';

export async function GET(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await (await supabase).auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const graph = await getCognitionGraph(user.id);
    return NextResponse.json(graph);
  } catch (error: any) {
    console.error('Cognition API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
