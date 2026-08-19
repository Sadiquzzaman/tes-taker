import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const validRoles: RoleUserType[] = ["TEACHER", "STUDENT", "ADMIN", "SUPER_ADMIN"];

const routePolicies: RoutePolicy[] = [
  {
    path: "/login",
    match: "exact",
    isPublic: true,
  },
  {
    path: "/signup",
    match: "prefix",
    isPublic: true,
  },
  {
    path: "/forgot-password",
    match: "exact",
    isPublic: true,
  },
  {
    path: "/auth/google/callback",
    match: "exact",
    isPublic: true,
  },
  {
    path: "/select-context",
    match: "exact",
    allowedRoles: ["TEACHER", "STUDENT", "ADMIN", "SUPER_ADMIN"],
    redirectUnauthorizedTo: "/dashboard",
  },
  {
    path: "/dashboard",
    match: "exact",
    allowedRoles: ["TEACHER", "STUDENT"],
    redirectUnauthorizedTo: "/classes",
  },
  {
    path: "/join",
    match: "prefix",
    isPublic: true,
  },
  {
    path: "/organization",
    match: "prefix",
    allowedRoles: ["TEACHER"],
    allowedSessionModes: ["organization"],
    redirectUnauthorizedTo: "/dashboard",
  },
  {
    path: "/classes/create",
    match: "exact",
    allowedRoles: ["TEACHER"],
    redirectUnauthorizedTo: "/organization",
  },
  {
    path: "/tests/create",
    match: "exact",
    allowedRoles: ["TEACHER"],
    blockedMemberRoles: ["ASSISTANT", "STUDENT"],
    redirectUnauthorizedTo: "/organization",
  },
  {
    path: "/grading",
    match: "prefix",
    allowedRoles: ["TEACHER"],
    blockedMemberRoles: ["ASSISTANT", "STUDENT"],
    redirectUnauthorizedTo: "/organization",
  },
  {
    path: "/billing",
    match: "prefix",
    allowedRoles: ["TEACHER"],
    blockedSessionModes: ["organization"],
    redirectUnauthorizedTo: "/organization",
  },
  {
    path: "/admin/organizations",
    match: "prefix",
    allowedRoles: ["ADMIN", "SUPER_ADMIN"],
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
    isPublic: true,
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

const getRoleHomeRoute = (
  role: RoleUserType | null,
  sessionMode: string | null,
  memberRole?: string | null,
) => {
  if (role === "STUDENT" || memberRole === "STUDENT") {
    return "/dashboard";
  }

  if (sessionMode === "organization") {
    if (memberRole === "TEACHER" || memberRole === "ASSISTANT") {
      return "/organization/classes";
    }
    return "/organization";
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
  const sessionMode = request.cookies.get("session_mode")?.value ?? "individual";
  const memberRole = request.cookies.get("member_role")?.value ?? null;
  const { pathname } = request.nextUrl;
  const matchedPolicy = routePolicies.find((policy) => matchesPolicy(pathname, policy));
  const isAuthenticated = Boolean(token);

  if (isStaticAsset(pathname)) {
    return NextResponse.next();
  }

  if (pathname === "/classes/details") {
    return NextResponse.redirect(new URL("/classes", request.url));
  }

  const legacyRegisterMatch = pathname.match(/^\/register:([0-9a-f-]{36})$/i);
  if (legacyRegisterMatch) {
    return NextResponse.redirect(new URL(`/join/class/${legacyRegisterMatch[1]}`, request.url));
  }

  if (matchedPolicy?.isPublic) {
    if (isAuthenticated) {
      if (pathname === "/" && role) {
        return createRedirectResponse(request, getRoleHomeRoute(role, sessionMode, memberRole));
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
    return createRedirectResponse(
      request,
      matchedPolicy.redirectUnauthorizedTo ?? getRoleHomeRoute(role, sessionMode, memberRole),
    );
  }

  if (
    matchedPolicy?.allowedSessionModes &&
    !matchedPolicy.allowedSessionModes.includes(sessionMode as "individual" | "organization")
  ) {
    return createRedirectResponse(
      request,
      sessionMode === "organization"
        ? getRoleHomeRoute(role, sessionMode, memberRole)
        : "/dashboard",
    );
  }

  if (
    matchedPolicy?.blockedSessionModes &&
    matchedPolicy.blockedSessionModes.includes(sessionMode as "individual" | "organization")
  ) {
    return createRedirectResponse(
      request,
      matchedPolicy.redirectUnauthorizedTo ?? getRoleHomeRoute(role, sessionMode, memberRole),
    );
  }

  if (
    matchedPolicy?.blockedMemberRoles &&
    memberRole &&
    matchedPolicy.blockedMemberRoles.includes(memberRole as OrganizationMemberRole)
  ) {
    return createRedirectResponse(
      request,
      matchedPolicy.redirectUnauthorizedTo ?? getRoleHomeRoute(role, sessionMode, memberRole),
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico|api/|session/|assets/).*)"],
};
