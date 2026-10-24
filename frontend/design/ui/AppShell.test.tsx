import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/i18n/test-utils";
import AppShell from "./AppShell";
import FilterBar from "./FilterBar";
import PageHeader from "./PageHeader";

let pathname = "/classes";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

afterEach(() => cleanup());

const shell = () => (
  <AppShell brand="Instructor" nav={<span>Tests</span>} navFooter={<button>Sign out</button>} title="Classes" actions={<span>Profile</span>}>
    <p>Page content</p>
  </AppShell>
);

describe("AppShell", () => {
  it("renders the page with its title, actions and navigation", () => {
    renderWithIntl(shell());
    expect(screen.getByText("Page content")).toBeTruthy();
    expect(screen.getByText("Profile")).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Main navigation" })).toBeTruthy();
  });

  it("opens the menu on phones and closes it after navigating", async () => {
    const view = renderWithIntl(shell());

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    expect(await screen.findByRole("dialog", { name: "Instructor" })).toBeTruthy();

    pathname = "/tests";
    view.rerender(shell());
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});

describe("PageHeader and FilterBar", () => {
  it("gives the page one top heading", () => {
    renderWithIntl(<PageHeader title="Classes" description="All your classes" actions={<button>New class</button>} />);
    expect(screen.getByRole("heading", { level: 1, name: "Classes" })).toBeTruthy();
  });

  it("searches and clears filters", () => {
    const onSearchChange = vi.fn();
    const onClear = vi.fn();
    renderWithIntl(<FilterBar search="phy" onSearchChange={onSearchChange} hasActiveFilters onClear={onClear} />);

    fireEvent.change(screen.getByRole("searchbox", { name: "Search" }), { target: { value: "chem" } });
    expect(onSearchChange).toHaveBeenCalledWith("chem");
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(onClear).toHaveBeenCalledOnce();
  });
});
