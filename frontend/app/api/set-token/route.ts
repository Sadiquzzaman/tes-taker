import { cookies } from "next/headers";

/**
 * Legacy path kept for local/dev compatibility.
 * Prefer POST /session/set-token — production reverse proxies often forward
 * /api/* to the Nest backend, which does not implement this route (404).
 */
export async function POST(req: Request) {
  const { token, refreshToken, role } = await req.json();

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

  return Response.json({ success: true });
}
