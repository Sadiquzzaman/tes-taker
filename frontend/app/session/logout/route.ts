import { cookies } from "next/headers";

/**
 * Clears auth cookies. Lives under /session/* to avoid colliding with Nest's
 * global /api prefix when a reverse proxy forwards /api to the backend.
 */
export async function POST() {
  const cookieStore = await cookies();
  const isProduction = process.env.NODE_ENV === "production";
  const expireOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };

  cookieStore.set("token", "", expireOptions);
  cookieStore.set("refreshToken", "", expireOptions);
  cookieStore.set("role", "", expireOptions);
  cookieStore.set("session_mode", "", expireOptions);
  cookieStore.set("member_role", "", expireOptions);
  cookieStore.set("organization_id", "", expireOptions);

  return Response.json({ success: true });
}
