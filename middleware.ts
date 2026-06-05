import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_ROUTES = ["/login", "/signup", "/waitlist", "/", "/api/ping", "/api/health", "/api/waitlist", "/api/webhooks/stripe"];
const CRON_ROUTES = ["/api/cron", "/api/internal/workers/process-events", "/api/internal"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestId =
    request.headers.get("x-request-id") ||
    request.headers.get("x-correlation-id") ||
    crypto.randomUUID();

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

    if (
      rawTokens.length === 0 ||
      (process.env.NODE_ENV !== "test" && rawTokens.every(t => t.length < 32 || weakSecrets.has(t)))
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

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
