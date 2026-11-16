import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { createTranslator } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "@/i18n/test-utils";
import en from "@/messages/en.json";
import Sidebar from "./Sidebar";

let cookieValues: Record<string, string> = {};
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (name in cookieValues ? { value: cookieValues[name] } : undefined) }),
}));
vi.mock("next-intl/server", () => ({ getTranslations: async () => createTranslator({ locale: "en", messages: en }) }));
vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));
let features: Record<string, boolean> = { attendance: true };
vi.mock("@/hooks/api/subscription/useEntitlements", () => ({ default: () => ({ entitlements: { features }, loading: false }) }));

beforeEach(() => {
  features = { attendance: true };
  localStorage.clear();
});
afterEach(() => cleanup());

const renderSidebar = async (cookies: Record<string, string>, activeRoute = "/dashboard", locale: "en" | "bn" = "en") => {
  cookieValues = cookies;
  renderApp(await Sidebar({ activeRoute }), { locale });
};

/** Every page in the menu, also those inside a folded group. */
const links = () => screen.getAllByRole("link", { hidden: true }).map((link) => link.textContent);
const group = (name: string) => screen.getByRole("button", { name });
const OWNER = { role: "TEACHER", session_mode: "organization", member_role: "OWNER" };

describe("sidebar billing and features (P2-02)", () => {
  it("shows a school's owner Billing and More features", async () => {
    await renderSidebar({ role: "TEACHER", session_mode: "organization", member_role: "OWNER" });
    expect(links()).toEqual(expect.arrayContaining(["Billing & Plans", "More features"]));
  });

  it("shows a school's teacher neither Billing nor More features (only owners and admins manage the plan)", async () => {
    await renderSidebar({ role: "TEACHER", session_mode: "organization", member_role: "TEACHER" });
    expect(links()).not.toContain("More features");
    expect(links()).not.toContain("Billing & Plans");
    cleanup();
    await renderSidebar({ role: "TEACHER", session_mode: "organization", member_role: "ASSISTANT" });
    expect(links()).not.toContain("More features");
  });

  it("shows a solo teacher both", async () => {
    await renderSidebar({ role: "TEACHER" });
    expect(links()).toEqual(expect.arrayContaining(["Billing & Plans", "More features"]));
  });

  it("gives platform admins the feature requests list", async () => {
    await renderSidebar({ role: "SUPER_ADMIN" });
    expect(links()).toContain("Feature requests");
    expect(links()).not.toContain("More features");
  });
});

describe("sidebar sessions (P2-03)", () => {
  it("shows a solo teacher Sessions in their own workspace", async () => {
    await renderSidebar({ role: "TEACHER", personal_teacher: "1" });
    expect(links()).toContain("Sessions");
  });

  it("hides it from a teacher with personal teaching off, who has no workspace of their own", async () => {
    await renderSidebar({ role: "TEACHER" });
    expect(links()).not.toContain("Sessions");
  });

  it("shows it to a school's owner, not to its teachers", async () => {
    await renderSidebar({ role: "TEACHER", session_mode: "organization", member_role: "OWNER" });
    expect(links()).toContain("Sessions");
    cleanup();
    await renderSidebar({ role: "TEACHER", session_mode: "organization", member_role: "TEACHER" });
    expect(links()).not.toContain("Sessions");
  });
});

describe("student menu", () => {
  it("starts with Today and has no Dashboard (it was only a workspace picker)", async () => {
    await renderSidebar({ role: "STUDENT", session_mode: "organization", member_role: "STUDENT" }, "/today");
    expect(links()[0]).toBe("Today");
    expect(links()).not.toContain("Dashboard");
  });

  it("puts Today first for a school owner and a solo teacher too", async () => {
    await renderSidebar(OWNER, "/today");
    expect(links()[0]).toBe("Today");
    cleanup();
    await renderSidebar({ role: "TEACHER", session_mode: "individual", personal_teacher: "1" }, "/today");
    expect(links().slice(0, 2)).toEqual(["Today", "Dashboard"]);
  });
});

describe("grouped menu", () => {
  it("folds a school owner's pages into groups, with Overview and Tests as links of their own", async () => {
    await renderSidebar(OWNER, "/organization");
    for (const name of ["People", "Academics", "Attendance", "Billing & plan", "Logs"]) expect(group(name)).toBeTruthy();
    // A group with one page is that page's link: no folding for one item.
    expect(screen.queryByRole("button", { name: "Tests" })).toBeNull();
    expect(screen.getByRole("link", { name: "Tests" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Overview" }).getAttribute("aria-current")).toBe("page");
  });

  it("opens the group of the current page and keeps the others closed", async () => {
    await renderSidebar(OWNER, "/attendance-register");
    expect(group("Attendance").getAttribute("aria-expanded")).toBe("true");
    expect(group("People").getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByRole("link", { name: "Monthly register" }).getAttribute("aria-current")).toBe("page");
    expect(screen.queryByRole("link", { name: "Teachers" })).toBeNull();
  });

  it("puts the attendance pages first and its setup pages after a Setup heading", async () => {
    await renderSidebar(OWNER, "/attendance");
    const list = within(document.getElementById("nav-group-attendance") as HTMLElement);
    expect(list.getAllByRole("link").map((link) => link.textContent)).toEqual([
      "Class attendance",
      "My attendance",
      "Leave",
      "Monthly register",
      "Attendance reports",
      "Class setup",
      "Branches",
      "Holidays",
      "Attendance settings",
    ]);
    expect(list.getByText("Setup")).toBeTruthy();
  });

  it("opens and closes a group on click and remembers it in this browser", async () => {
    await renderSidebar(OWNER, "/organization");
    fireEvent.click(group("People"));
    expect(group("People").getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("link", { name: "Students" })).toBeTruthy();
    cleanup();
    await renderSidebar(OWNER, "/organization");
    expect(group("People").getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(group("People"));
    expect(screen.queryByRole("link", { name: "Students" })).toBeNull();
  });

  it("leaves the Attendance group out while the plan has attendance off", async () => {
    features = { attendance: false };
    await renderSidebar(OWNER, "/organization");
    expect(screen.queryByRole("button", { name: "Attendance" })).toBeNull();
    expect(links()).not.toContain("Class attendance");
  });

  it("groups a platform admin's pages too", async () => {
    await renderSidebar({ role: "SUPER_ADMIN" }, "/admin/plans");
    expect(group("Customers")).toBeTruthy();
    expect(group("Plans & payments").getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("link", { name: "Audit log" })).toBeTruthy();
  });

  it("names the groups in Bangla", async () => {
    await renderSidebar(OWNER, "/organization", "bn");
    expect(screen.getByRole("button", { name: "উপস্থিতি" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "সদস্য" })).toBeTruthy();
  });
});

describe("IELTS centres (P10-01)", () => {
  it("shows an IELTS centre's staff IELTS students and none of the school-only results pages", async () => {
    features = { attendance: true, performance: true, ielts: true };
    await renderSidebar({ ...OWNER, workspace_type: "IELTS" });
    expect(links()).toContain("IELTS students");
    for (const schoolOnly of ["Performance", "Report cards", "Paper exams", "Behaviour", "Grading scale"]) expect(links()).not.toContain(schoolOnly);
  });

  it("keeps a school's menu as it was, without IELTS pages", async () => {
    features = { attendance: true, performance: true, ielts: true };
    await renderSidebar(OWNER);
    expect(links()).not.toContain("IELTS students");
    expect(links()).toEqual(expect.arrayContaining(["Performance", "Report cards"]));
  });

  it("shows an IELTS centre's student their IELTS profile", async () => {
    features = { ielts: true };
    await renderSidebar({ role: "STUDENT", session_mode: "organization", member_role: "STUDENT", workspace_type: "IELTS" });
    expect(links()).toContain("My IELTS profile");
  });
});

describe("sidebar for solo IELTS trainers (P12-03)", () => {
  it("shows a solo IELTS trainer the IELTS staff pages in their own workspace, and an academic solo teacher none", async () => {
    features = { attendance: true, ielts: true };
    await renderSidebar({ role: "TEACHER", personal_teacher: "1", workspace_type: "IELTS" });
    expect(links()).toEqual(expect.arrayContaining(["IELTS tests", "Marking"]));
    expect(links()).not.toContain("Marks");
    cleanup();
    await renderSidebar({ role: "TEACHER", personal_teacher: "1" });
    expect(links()).not.toContain("IELTS tests");
  });
});

describe("sidebar for branch managers (P12-01)", () => {
  it("shows a branch manager Today only from the organisation's pages, until branch tools are opened to them", async () => {
    await renderSidebar({ role: "TEACHER", session_mode: "organization", member_role: "BRANCH_MANAGER" });
    expect(links()).toContain("Today");
    expect(links()).not.toContain("Billing & Plans");
    expect(links()).not.toContain("Teachers");
    expect(links()).not.toContain("Students");
  });
});

describe("sidebar in IELTS workspaces (P12-03)", () => {
  it("hides sessions, subjects, subject teachers, academic tests, grading and leave from an IELTS centre, and keeps them for a school", async () => {
    features = { attendance: true, ielts: true };
    await renderSidebar({ role: "TEACHER", session_mode: "organization", member_role: "OWNER", workspace_type: "IELTS" });
    for (const page of ["Sessions", "Subjects", "Subject teachers", "Tests", "Grading", "Leave"]) expect(links()).not.toContain(page);
    expect(links()).toContain("IELTS tests");
    cleanup();
    await renderSidebar({ role: "TEACHER", session_mode: "organization", member_role: "OWNER" });
    expect(links()).toEqual(expect.arrayContaining(["Sessions", "Subjects", "Subject teachers", "Leave"]));
  });
});
