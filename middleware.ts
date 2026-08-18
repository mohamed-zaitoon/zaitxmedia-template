import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextRequest, NextResponse, NextFetchEvent } from "next/server";

const IS_DEV = process.env.NODE_ENV === "development";
const MAIN_DOMAIN = "zaitxmedia.com";
const AUTH_DOMAIN = "auth.zaitxmedia.com";
const ADMIN_DOMAIN = "admin.zaitxmedia.com";
const API_DOMAIN = "api.zaitxmedia.com";

// Only protect store routes on the main domain via Clerk
const isProtectedRoute = createRouteMatcher([
  '/account(.*)',
  '/orders(.*)',
  '/recharge(.*)',
]);

const CORS_HEADERS = {
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

const ALLOWED_ORIGINS = [
  "https://admin.zaitxmedia.com",
  "https://zaitxmedia.com",
  "http://localhost:3000",
];

function getCorsOrigin(req: Request): string {
  const origin = req.headers.get("origin") || "";
  return ALLOWED_ORIGINS.includes(origin) ? origin : "";
}

function applySecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-XSS-Protection", "1; mode=block");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  res.headers.set("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  res.headers.set("Cross-Origin-Resource-Policy", "same-origin");
  return res;
}

const clerkHandler = clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
  return applySecurityHeaders(NextResponse.next());
});

export default async function middleware(req: NextRequest, event: NextFetchEvent) {
  const host = req.headers.get("host") || "";
  const hostname = host.split(":")[0];
  const url = req.nextUrl.clone();
  const pathname = url.pathname;

  // ── Development pass-through ─────────────────────────────────────────────
  if (IS_DEV && (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    /^\d+\.\d+\.\d+\.\d+$/.test(hostname) ||
    hostname.endsWith(".workers.dev")
  )) {
    return NextResponse.next();
  }

  // ── Admin Subdomain (admin.zaitxmedia.com) — BYPASS CLERK COMPLETELY ─────
  if (hostname === ADMIN_DOMAIN) {
    if (pathname === "/login" || pathname === "/sign-up") return applySecurityHeaders(NextResponse.next());
    if (pathname.startsWith("/api/")) return applySecurityHeaders(NextResponse.next());
    
    const rewritePath = pathname === "/"
      ? "/admin"
      : pathname.startsWith("/admin")
        ? pathname
        : `/admin${pathname}`;
    url.pathname = rewritePath;
    return applySecurityHeaders(NextResponse.rewrite(url));
  }

  // ── API Subdomain (api.zaitxmedia.com) — BYPASS CLERK COMPLETELY ──────────
  if (hostname === API_DOMAIN) {
    const corsOrigin = getCorsOrigin(req);
    if (req.method === "OPTIONS") {
      return new NextResponse(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": corsOrigin || ALLOWED_ORIGINS[0],
          ...CORS_HEADERS,
        },
      });
    }

    if (pathname === "/") {
      return NextResponse.json({ status: "ok", version: "1.0.0" });
    }

    let rewriteTo: string | null = null;
    if (
      pathname.startsWith("/orders") ||
      pathname.startsWith("/notify-order") ||
      pathname.startsWith("/financial") ||
      pathname.startsWith("/payment") ||
      pathname.startsWith("/reserve")
    ) {
      rewriteTo = `/api/admin${pathname}`;
    } else if (pathname.startsWith("/v1") || pathname.startsWith("/recharges")) {
      rewriteTo = `/api${pathname}`;
    } else if (pathname.startsWith("/api")) {
      rewriteTo = pathname;
    }

    if (rewriteTo) {
      url.pathname = rewriteTo;
      const response = NextResponse.rewrite(url);
      if (corsOrigin) {
        response.headers.set("Access-Control-Allow-Origin", corsOrigin);
        response.headers.set("Access-Control-Allow-Methods", CORS_HEADERS["Access-Control-Allow-Methods"]);
        response.headers.set("Access-Control-Allow-Headers", CORS_HEADERS["Access-Control-Allow-Headers"]);
      }
      return applySecurityHeaders(response);
    }
    return applySecurityHeaders(NextResponse.json({ error: "Not found" }, { status: 404 }));
  }

  // ── Auth Subdomain ─────────────────────────────────────────────────────────
  if (hostname === AUTH_DOMAIN) {
    if (pathname === "/") return NextResponse.redirect(`https://${MAIN_DOMAIN}/login`, 302);
    if (pathname.startsWith("/v3")) return NextResponse.next();
    return new NextResponse("Not Found", { status: 404 });
  }

  // ── Main Domain (zaitxmedia.com) — Run Clerk Auth Handler ──────────────────
  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/api")) {
    return NextResponse.redirect(`https://${ADMIN_DOMAIN}${pathname}${url.search}`, 302);
  }

  return clerkHandler(req, event);
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
