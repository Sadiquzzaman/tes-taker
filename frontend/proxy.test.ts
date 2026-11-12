import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "./proxy";

const visit = (path: string, cookies: Record<string, string>) => {
  const request = new NextRequest(new URL(path, "https://beta.example.test"));
  for (const [name, value] of Object.entries(cookies)) request.cookies.set(name, value);
  const response = proxy(request);
  const location = response.headers.get("location");
  return location ? new URL(location).pathname : "open";
};

const school = (memberRole: string) => ({ token: "t", role: "TEACHER", session_mode: "organization", member_role: memberRole });

/** Found by the beta access check (13 Nov): the menu showed Billing to school owners, but the page sent them away. */
describe("billing page access", () => {
  it("opens Billing for a school's owners and admins and for solo teachers, not for teachers, staff or students", () => {
    expect(visit("/billing", school("OWNER"))).toBe("open");
    expect(visit("/billing", school("ADMIN"))).toBe("open");
    expect(visit("/billing", { token: "t", role: "TEACHER", session_mode: "individual", personal_teacher: "1" })).toBe("open");
    for (const role of ["TEACHER", "ASSISTANT"]) expect(visit("/billing", school(role))).toBe("/today");
    expect(visit("/billing", { token: "t", role: "STUDENT", session_mode: "organization", member_role: "STUDENT" })).not.toBe("open");
    expect(visit("/billing", {})).toBe("/login");
  });
});
