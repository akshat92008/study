import { createClient } from '@/lib/supabase/server';
import { NextResponse, type NextRequest } from 'next/server';

export type RouteHandler = (
  req: NextRequest,
  context: any
) => Promise<NextResponse> | NextResponse;

export function withBetaUserRoute(handler: RouteHandler): RouteHandler {
  return async (req: NextRequest, context: any) => {
    try {
      const supabase = await createClient();
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_beta_user, role')
        .eq('id', user.id)
        .single();

      const isBeta = profile?.is_beta_user === true || profile?.role === 'admin' || profile?.role === 'developer';

      if (!isBeta) {
        return NextResponse.json(
          { error: 'Beta Access Required', message: 'You must be a beta user to access this endpoint.' },
          { status: 403 }
        );
      }

      return await handler(req, context);
    } catch (error) {
      console.error('[BETA_ROUTE_ERROR]', error);
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  };
}
