import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const validRoles: RoleUserType[] = ["TEACHER", "STUDENT", "ADMIN", "SUPER_ADMIN"];

const routePolicies: RoutePolicy[] = [
  {
    path: "/login",
    match: "exact",
    isPublic: true,
    // redirectAuthenticatedTo: "/",
  },
  {
    path: "/signup",
    match: "exact",
    isPublic: true,
    // redirectAuthenticatedTo: "/",
  },
  {
    path: "/forgot-password",
    match: "exact",
    isPublic: true,
  },
  {
    path: "/join",
    match: "prefix",
    isPublic: true,
  },
  {
    path: "/classes/create",
    match: "exact",
    allowedRoles: ["TEACHER"],
    redirectUnauthorizedTo: "/classes",
  },
  {
    path: "/tests/create",
    match: "exact",
    allowedRoles: ["TEACHER"],
    redirectUnauthorizedTo: "/tests",
  },
  {
    path: "/grading",
    match: "prefix",
    allowedRoles: ["TEACHER"],
    redirectUnauthorizedTo: "/dashboard",
  },
  {
    path: "/dashboard",
    match: "exact",
    allowedRoles: ["TEACHER"],
    redirectUnauthorizedTo: "/classes",
  },
  {
    path: "/admin/super",
    match: "prefix",
    allowedRoles: ["SUPER_ADMIN"],
    redirectUnauthorizedTo: "/admin",
  },
  {
    path: "/admin",
    match: "prefix",
    allowedRoles: ["ADMIN", "SUPER_ADMIN"],
    redirectUnauthorizedTo: "/dashboard",
  },
  {
    path: "/payment",
    match: "prefix",
    allowedRoles: ["TEACHER"],
    redirectUnauthorizedTo: "/login",
  },
  {
    path: "/tests",
    match: "prefix",
    allowedRoles: ["TEACHER", "STUDENT"],
  },
  {
    path: "/test",
    match: "prefix",
    allowedRoles: ["STUDENT"],
    redirectUnauthorizedTo: "/tests",
  },
  {
    path: "/",
    match: "exact",
    isPublic: true,
  },
  {
    path: "/classes",
    match: "prefix",
    allowedRoles: ["TEACHER", "STUDENT"],
  },
];

const isStaticAsset = (pathname: string) =>
  pathname.startsWith("/_next") ||
  pathname.startsWith("/assets") ||
  pathname.startsWith("/favicon.ico") ||
  pathname.match(/\.(jpg|jpeg|png|svg|webp|gif)$/);

const isValidRole = (role: string | undefined): role is RoleUserType =>
  Boolean(role && validRoles.includes(role as RoleUserType));

const matchesPolicy = (pathname: string, policy: RoutePolicy) => {
  if (policy.match === "prefix") {
    if (policy.path === "/test") {
      return pathname === "/test" || pathname.startsWith("/test/");
    }

    return pathname.startsWith(policy.path);
  }

  return pathname === policy.path;
};

const getRoleHomeRoute = (role: RoleUserType | null) => {
  if (role === "STUDENT") {
    return "/classes";
  }

  if (role === "ADMIN" || role === "SUPER_ADMIN") {
    return "/admin";
  }

  return "/dashboard";
};

const createRedirectResponse = (request: NextRequest, pathname: string) => {
  const url = new URL(pathname, request.url);

  return NextResponse.redirect(url);
};

export function proxy(request: NextRequest) {
  const token = request.cookies.get("token")?.value ?? null;
  const roleValue = request.cookies.get("role")?.value;
  const role = isValidRole(roleValue) ? roleValue : null;
  const { pathname } = request.nextUrl;
  const matchedPolicy = routePolicies.find((policy) => matchesPolicy(pathname, policy));
  const isAuthenticated = Boolean(token);

  if (isStaticAsset(pathname)) {
    return NextResponse.next();
  }

  if (pathname === "/classes/details") {
    return NextResponse.redirect(new URL("/classes", request.url));
  }

  if (matchedPolicy?.isPublic) {
    if (isAuthenticated) {
      if (pathname === "/" && role) {
        return createRedirectResponse(request, getRoleHomeRoute(role));
      }

      if (matchedPolicy.redirectAuthenticatedTo) {
        return createRedirectResponse(request, matchedPolicy.redirectAuthenticatedTo);
      }
    }

    return NextResponse.next();
  }

  if (!isAuthenticated || !role) {
    return createRedirectResponse(request, "/login");
  }

  if (matchedPolicy?.allowedRoles && !matchedPolicy.allowedRoles.includes(role)) {
    return createRedirectResponse(request, matchedPolicy.redirectUnauthorizedTo ?? getRoleHomeRoute(role));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico|api/|assets/).*)"],
};
