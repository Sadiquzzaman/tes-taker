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

const student = { token: "t", role: "STUDENT", session_mode: "organization", member_role: "STUDENT" };
const solo = { token: "t", role: "TEACHER", session_mode: "individual", personal_teacher: "1" };
const platform = { token: "t", role: "ADMIN", session_mode: "individual" };

/** Found by the beta access check (13 Nov): staff pages opened for students with "could not be loaded". */
describe("pages people cannot use send them home", () => {
  it("keeps students out of the staff pages", () => {
    for (const path of ["/attendance", "/attendance-setup", "/attendance-settings", "/attendance-reports", "/attendance-register", "/attendance-branches", "/homework-settings", "/features", "/behaviour", "/performance-settings"]) {
      expect([path, visit(path, student)]).toEqual([path, "/today"]);
      expect([path, visit(path, school("TEACHER"))]).toEqual([path, "open"]);
      expect([path, visit(path, solo)]).toEqual([path, "open"]);
    }
    // Their own pages stay open.
    for (const path of ["/my-attendance", "/homework", "/leave", "/calendar", "/routine", "/today", "/marks"]) expect([path, visit(path, student)]).toEqual([path, "open"]);
  });

  it("opens the activity and message logs to a school's owners and admins and to solo teachers only", () => {
    for (const path of ["/activity-log", "/message-log"]) {
      expect(visit(path, school("OWNER"))).toBe("open");
      expect(visit(path, school("ADMIN"))).toBe("open");
      expect(visit(path, solo)).toBe("open");
      for (const role of ["TEACHER", "ASSISTANT"]) expect(visit(path, school(role))).toBe("/today");
      expect(visit(path, student)).toBe("/today");
    }
  });

  it("sends a refused page to the person's home in one step: Today, or Admin for platform admins", () => {
    expect(visit("/organization", solo)).toBe("/today");
    expect(visit("/organization", student)).toBe("/today");
    expect(visit("/classes/create", student)).toBe("/today");
    expect(visit("/grading", school("ASSISTANT"))).toBe("/today");
    expect(visit("/organization", platform)).toBe("/admin");
    expect(visit("/today", platform)).toBe("/admin");
    expect(visit("/admin/organizations", school("OWNER"))).toBe("/today");
    expect(visit("/dashboard", platform)).toBe("/admin");
  });
});
