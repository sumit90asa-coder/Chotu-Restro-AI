import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Intercept and protect all dashboard routes
  if (pathname.startsWith("/dashboard")) {
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
    "/kds/:path*",
    "/orders/:path*",
    "/menu/:path*",
    "/inventory/:path*",
    "/analytics/:path*",
    "/staff/:path*",
    "/settings/:path*",
  ],
};
