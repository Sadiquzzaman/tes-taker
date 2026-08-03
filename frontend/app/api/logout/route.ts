import { cookies } from "next/headers";

/** Legacy logout path. Prefer POST /session/logout. */
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

  return Response.json({ success: true });
}
