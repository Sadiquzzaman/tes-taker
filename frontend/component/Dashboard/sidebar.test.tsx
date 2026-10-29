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
