import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/pos",
  "/tables",
  "/orders",
  "/kds",
  "/delivery",
  "/menu",
  "/inventory",
  "/customers",
  "/staff",
  "/expenses",
  "/ai",
  "/insights",
  "/analytics",
  "/marketing",
  "/settings",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (isProtected) {
    const tokenCookie = request.cookies.get("chotu_auth_token");
    const token = tokenCookie?.value;

    // Reject unauthenticated requests or stale/invalid demo tokens
    if (!token || token === "demo-token") {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/pos/:path*",
    "/tables/:path*",
    "/orders/:path*",
    "/kds/:path*",
    "/delivery/:path*",
    "/menu/:path*",
    "/inventory/:path*",
    "/customers/:path*",
    "/staff/:path*",
    "/expenses/:path*",
    "/ai/:path*",
    "/insights/:path*",
    "/analytics/:path*",
    "/marketing/:path*",
    "/settings/:path*",
  ],
};
