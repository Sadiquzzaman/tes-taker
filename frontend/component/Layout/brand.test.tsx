import { cleanup, screen } from "@testing-library/react";
import { createTranslator } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "@/i18n/test-utils";
import en from "@/messages/en.json";
import { AppBrand } from "./index";

vi.mock("next-intl/server", () => ({ getTranslations: async (namespace: string) => createTranslator({ locale: "en", messages: en, namespace: namespace as "nav" }) }));
vi.mock("../Dashboard/Sidebar", () => ({ default: () => null }));
vi.mock("../Dashboard/Header", () => ({ default: () => null, HeaderActions: () => null }));
vi.mock("../Dashboard/SidebarLogout", () => ({ default: () => null }));
vi.mock("./WorkspaceClientProvider", () => ({ default: ({ children }: { children: React.ReactNode }) => children }));

afterEach(() => cleanup());

/** The logo and name in the signed-in sidebar take you home: Today, where every workspace opens. */
describe("app brand", () => {
  it("links to Today", async () => {
    renderApp(await AppBrand());
    const link = screen.getByRole("link", { name: "Instructor: go to Today" });
    expect(link.getAttribute("href")).toBe("/today");
    expect(link.textContent).toContain("Instructor");
  });
});
