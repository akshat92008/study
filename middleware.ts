import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_ROUTES = ["/login", "/signup", "/", "/api/health"];
const CRON_ROUTES = ["/api/cron", "/api/events/process", "/api/internal"];
const MVP_DISABLED_ROUTES = [
  "/analytics",
  "/educator",
  "/health",
  "/knowledge",
  "/mistakes",
  "/planner",
  "/api/admin",
  "/api/billing",
  "/api/ingest",
  "/api/knowledge",
  "/api/mistakes",
  "/api/planner",
  "/api/ai/analyze",
  "/api/ai/health",
  "/api/ai/negotiate",
  "/api/ai/revision-coach",
  "/api/ai/setup",
  "/api/ai/welcome",
  "/api/webhooks/stripe",
  "/goals",
  "/api/goals",
  "/api/onboarding",
  "/api/sessions/today",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestId =
    request.headers.get("x-request-id") ||
    request.headers.get("x-correlation-id") ||
    crypto.randomUUID();

  if (MVP_DISABLED_ROUTES.some(r => pathname === r || pathname.startsWith(`${r}/`))) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          error: "disabled_for_mvp",
          message: "This feature is not part of the production MVP.",
        },
        {
          status: 404,
          headers: { "x-request-id": requestId },
        }
      );
    }
    return new NextResponse("Not Found", { status: 404 });
  }

  // Cron routes need secret validation
  if (CRON_ROUTES.some(r => pathname.startsWith(r))) {
    const secret = process.env.CRON_SECRET;
    if (!secret || secret === "super_secret_cron_token_123") {
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
