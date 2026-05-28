import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: any) {
          cookiesToSet.forEach(({ name, value }: any) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }: any) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protected routes — redirect to login if not authenticated
  if (
    !user &&
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/signup') &&
    !request.nextUrl.pathname.startsWith('/api/migrate') &&
    request.nextUrl.pathname !== '/'
  ) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  let onboardingComplete: boolean | null = null;

  if (user) {
    const cachedOb = request.cookies.get('_ob');
    if (cachedOb) {
      onboardingComplete = cachedOb.value === '1';
    } else {
      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_complete')
        .eq('id', user.id)
        .single();

      onboardingComplete = profile?.onboarding_complete ?? false;
    }
  }

  const isOnboarded = onboardingComplete === true;

  let finalResponse = supabaseResponse;
  let shouldRedirect = false;
  const url = request.nextUrl.clone();

  // Redirect authenticated users away from public routes to dashboard/onboarding
  if (
    user &&
    (request.nextUrl.pathname === '/' ||
      request.nextUrl.pathname.startsWith('/login') ||
      request.nextUrl.pathname.startsWith('/signup'))
  ) {
    url.pathname = isOnboarded ? '/dashboard' : '/onboarding';
    shouldRedirect = true;
  } else if (
    user &&
    !isOnboarded &&
    !request.nextUrl.pathname.startsWith('/api') &&
    !request.nextUrl.pathname.startsWith('/onboarding')
  ) {
    url.pathname = '/onboarding';
    shouldRedirect = true;
  } else if (
    user &&
    isOnboarded &&
    request.nextUrl.pathname.startsWith('/onboarding')
  ) {
    url.pathname = '/dashboard';
    shouldRedirect = true;
  }

  if (shouldRedirect) {
    finalResponse = NextResponse.redirect(url);
  }

  if (user && onboardingComplete !== null) {
    finalResponse.cookies.set('_ob', isOnboarded ? '1' : '0', {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 5, // 5 minutes
      path: '/',
    });
  }

  return finalResponse;
}
