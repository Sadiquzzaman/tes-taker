"use server";

import { cookies } from "next/headers";

export async function toggleSidebar() {
  const cookieStore = await cookies();
  const current = cookieStore.get("sidebar")?.value;

  cookieStore.set("sidebar", current === "open" ? "closed" : "open", {
    path: "/",
    httpOnly: true,
  });
}
