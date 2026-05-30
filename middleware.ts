import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_ROUTES = ["/login", "/signup", "/", "/api/health"];
const CRON_ROUTES = ["/api/cron", "/api/events/process"];
const MVP_DISABLED_ROUTES = [
  "/analytics",
  "/educator",
  "/knowledge",
  "/mentor",
  "/mistakes",
  "/planner",
  "/tutor",
  "/api/admin",
  "/api/billing",
  "/api/knowledge",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Cron routes need secret validation
  if (CRON_ROUTES.some(r => pathname.startsWith(r))) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    return NextResponse.next();
  }

  if (MVP_DISABLED_ROUTES.some(r => pathname === r || pathname.startsWith(`${r}/`))) {
    return new NextResponse("Not Found", { status: 404 });
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
      return new NextResponse("Unauthorized", { status: 401 });
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
