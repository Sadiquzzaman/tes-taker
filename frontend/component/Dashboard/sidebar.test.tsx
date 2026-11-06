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

  it("shows a school's teacher More features but not Billing", async () => {
    await renderSidebar({ role: "TEACHER", session_mode: "organization", member_role: "TEACHER" });
    expect(links()).toContain("More features");
    expect(links()).not.toContain("Billing & Plans");
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
