import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_ROUTES = ["/login", "/signup", "/", "/api/health", "/api/webhooks/stripe"];
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
    const weakSecrets = new Set([
      "super_secret_cron_token_123",
      "test-secret",
      "changeme",
      "change-me",
      "secret",
      "cron_secret",
    ]);
    if (
      !secret ||
      (process.env.NODE_ENV !== "test" && (secret.length < 32 || weakSecrets.has(secret)))
    ) {
      return NextResponse.json(
        {
          error: "cron_not_configured",
          message: "Cron authentication is not configured.",
          requestId,
        },
        { status: 500, headers: { "x-request-id": requestId } }
      );
    }
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${secret}`) {
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
