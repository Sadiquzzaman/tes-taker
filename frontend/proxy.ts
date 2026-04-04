import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const token = request.cookies.get("token");
  const { pathname } = request.nextUrl;

  // always allow Next.js internal files
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/assets") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.match(/\.(jpg|jpeg|png|svg|webp|gif)$/)
  ) {
    return NextResponse.next();
  }

  // redirect /classes/details -> /classes
  if (pathname === "/classes/details") {
    return NextResponse.redirect(new URL("/classes", request.url));
  }

  // allow public routes
  const publicRoutes = ["/login", "/signup"];
  if (!token && !publicRoutes.includes(pathname)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico|api/|assets/).*)"],
};
