import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isFeatureEnabled, type AppFeature } from '@/lib/feature-registry';

const PUBLIC_ROUTES = ["/login", "/signup", "/waitlist", "/", "/api/ping", "/api/health", "/api/waitlist", "/api/webhooks/stripe", "/privacy", "/terms", "/refund", "/support"];
const CRON_ROUTES = ["/api/cron", "/api/internal/workers/process-events", "/api/internal"];

// MVP Route Policy: Block non-MVP user-facing routes
const MVP_RESTRICTIONS: Array<{ path: string; flag?: AppFeature; redirect?: string }> = [
  { path: "/planner", flag: undefined, redirect: "/dashboard" },
  { path: "/mentor", flag: undefined, redirect: "/dashboard" },
  { path: "/tutor", flag: undefined, redirect: "/dashboard" },
  { path: "/analytics", flag: 'analytics_ui', redirect: "/dashboard" },
  { path: "/cognition", flag: 'atlas_ui', redirect: "/dashboard" },
  { path: "/health", flag: undefined, redirect: "/dashboard" },
  { path: "/pulse", flag: undefined, redirect: "/dashboard" },
];

const PROTECTED_APIS: Array<{ path: string; redirect?: string }> = [
  { path: "/api/planner" },
  { path: "/api/mentor" },
  { path: "/api/tutor" },
  { path: "/api/analytics" },
  { path: "/api/internal" },
];

// Admin routes — use real URL paths (not Next.js route-group notation)
const ADMIN_ROUTES = ["/admin", "/api/admin"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestId =
    request.headers.get("x-request-id") ||
    request.headers.get("x-correlation-id") ||
    crypto.randomUUID();

  // MVP API Protection (Block non-MVP APIs)
  if (PROTECTED_APIS.some(r => pathname.startsWith(r.path))) {
    // Check if it's a cron/worker request first (already handled by CRON_ROUTES)
    if (!CRON_ROUTES.some(r => pathname.startsWith(r))) {
      return NextResponse.json({ error: "forbidden", message: "This API is restricted in MVP." }, { status: 403 });
    }
  }

  // Cron routes need secret validation
  if (CRON_ROUTES.some(r => pathname.startsWith(r))) {
    const secret = process.env.INTERNAL_CRON_SECRET || process.env.CRON_SECRET;
    const workerSecret = process.env.INTERNAL_WORKER_SECRET;
    const weakSecrets = new Set([
      "super_secret_cron_token_123",
      "super_secret_worker_token_123",
      "test-secret",
      "changeme",
      "change-me",
      "secret",
      "cron_secret",
      "worker_secret",
    ]);
    const workerHeader = request.headers.get("x-internal-worker-secret");
    const authHeader = request.headers.get("authorization");

    if (workerHeader !== null) {
      if (
        !workerSecret ||
        (process.env.NODE_ENV !== "test" && (workerSecret.length < 32 || weakSecrets.has(workerSecret)))
      ) {
        return NextResponse.json(
          {
            error: "worker_not_configured",
            message: "Worker authentication is not configured.",
            requestId,
          },
          { status: 500, headers: { "x-request-id": requestId } }
        );
      }

      if (workerHeader !== workerSecret) {
        return NextResponse.json(
          {
            error: "unauthorized",
            message: "Worker authentication is required.",
            requestId,
          },
          { status: 401, headers: { "x-request-id": requestId } }
        );
      }

      return NextResponse.next();
    }

    const cronSecret = process.env.CRON_SECRET;
    const internalCronSecret = process.env.INTERNAL_CRON_SECRET;
    
    const rawTokens = [cronSecret, internalCronSecret].filter(Boolean) as string[];
    const validCronTokens = rawTokens.flatMap(t => [`Bearer ${t}`, t]);
    const primarySecretIsWeak =
      !secret ||
      (process.env.NODE_ENV !== "test" && (secret.length < 32 || weakSecrets.has(secret)));

    if (
      rawTokens.length === 0 ||
      (primarySecretIsWeak && rawTokens.every(t => t.length < 32 || weakSecrets.has(t)))
    ) {
      return NextResponse.json(
        {
          error: "cron_not_configured",
          message: "Cron authentication is not configured or uses weak secrets.",
          requestId,
        },
        { status: 500, headers: { "x-request-id": requestId } }
      );
    }

    if (!authHeader || !validCronTokens.includes(authHeader)) {
      return NextResponse.json(
        {
          error: "unauthorized",
          message: "Cron authentication is required.",
          requestId,
        },
        { status: 401, headers: { "x-request-id": requestId } }
      );
    }
    return NextResponse.next();
  }

  // Public routes
  if (PUBLIC_ROUTES.some(r => pathname === r || pathname.startsWith("/_next"))) {
    return NextResponse.next();
  }

  // Auth check
  const response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies: any[]) => {
          cookies.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  response.headers.set("x-pathname", pathname);

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          error: "unauthorized",
          message: "Authentication is required.",
          requestId,
        },
        { status: 401, headers: { "x-request-id": requestId } }
      );
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // MVP Route Gating
  for (const restriction of MVP_RESTRICTIONS) {
    if (pathname.startsWith(restriction.path)) {
      const isEnabled = restriction.flag ? isFeatureEnabled(restriction.flag) : false;
      if (!isEnabled) {
        return NextResponse.redirect(new URL(restriction.redirect || "/dashboard", request.url));
      }
    }
  }

  // Admin Route Protection — server-side gate (defense in depth, middleware is primary guard)
  if (ADMIN_ROUTES.some(r => pathname.startsWith(r))) {
    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);
    const adminUserIds = (process.env.ADMIN_USER_IDS || '').split(',').map(e => e.trim()).filter(Boolean);
    const isEmailAdmin = user.email && adminEmails.includes(user.email);
    const isIdAdmin = adminUserIds.includes(user.id);

    let isAdmin = isEmailAdmin || isIdAdmin;

    if (!isAdmin) {
      const { data: adminUser } = await supabase
        .from("admin_users")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();
      isAdmin = !!adminUser;
    }

    if (!isAdmin) {
      // Log unauthorized admin access attempt for security auditing
      console.warn(`[SECURITY] Unauthorized admin access attempt by user ${user.id} on ${pathname}`);
      if (pathname.startsWith("/api/")) {
        // Return 403 for API routes (not 404 — caller should know they're unauthorized)
        return NextResponse.json(
          { error: "forbidden", message: "Admin access required.", requestId },
          { status: 403, headers: { "x-request-id": requestId } }
        );
      }
      // Return 404 for page routes — do not reveal that the admin section exists
      return new NextResponse(null, { status: 404 });
    }
  }


  if (pathname === '/chat' && !isFeatureEnabled('chat')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
