import { cookies } from "next/headers";

/**
 * Next.js route handler that stores auth cookies for proxy/middleware.
 *
 * IMPORTANT: This lives under /session/* (not /api/*) so production reverse
 * proxies that forward /api to the Nest backend cannot intercept it.
 */
export async function POST(req: Request) {
  const { token, refreshToken, role, sessionMode, memberRole, organizationId } = await req.json();

  if (!token || !role) {
    return Response.json({ success: false, message: "token and role are required" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const isProduction = process.env.NODE_ENV === "production";
  const cookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax" as const,
    path: "/",
  };

  cookieStore.set("token", token, cookieOptions);
  cookieStore.set("refreshToken", refreshToken ?? "", cookieOptions);
  cookieStore.set("role", role, cookieOptions);
  cookieStore.set(
    "session_mode",
    sessionMode === "organization" ? "organization" : "individual",
    cookieOptions,
  );
  cookieStore.set("member_role", typeof memberRole === "string" ? memberRole : "", cookieOptions);
  cookieStore.set(
    "organization_id",
    typeof organizationId === "string" ? organizationId : "",
    cookieOptions,
  );

  return Response.json({ success: true });
}
