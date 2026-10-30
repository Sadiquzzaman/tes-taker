import { cleanup, screen } from "@testing-library/react";
import { createTranslator } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "@/i18n/test-utils";
import en from "@/messages/en.json";
import Sidebar from "./Sidebar";

let cookieValues: Record<string, string> = {};
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (name in cookieValues ? { value: cookieValues[name] } : undefined) }),
}));
vi.mock("next-intl/server", () => ({ getTranslations: async () => createTranslator({ locale: "en", messages: en }) }));
vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));

afterEach(() => cleanup());

const renderSidebar = async (cookies: Record<string, string>) => {
  cookieValues = cookies;
  renderApp(await Sidebar({ activeRoute: "/dashboard" }));
};

const links = () => screen.getAllByRole("link").map((link) => link.textContent);

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
