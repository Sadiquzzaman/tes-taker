import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/i18n/test-utils";
import Avatar, { initialsOf } from "./Avatar";
import Badge, { StatusPill } from "./Badge";
import Card from "./Card";
import StatTile from "./StatTile";
import Tag from "./Tag";

afterEach(() => cleanup());

describe("display components", () => {
  it("formats StatTile numbers for the page language", () => {
    renderWithIntl(<StatTile label="ছাত্রছাত্রী" value={1284} change={32} />, "bn");
    expect(screen.getByText("১,২৮৪")).toBeTruthy();
    expect(screen.getByText("৩২")).toBeTruthy();
  });

  it("shows a falling number as bad unless lower is better", () => {
    const { container } = renderWithIntl(<StatTile label="Absences" value={41} change={-5} higherIsBetter={false} />);
    expect(container.querySelector(".text-success")?.textContent).toBe("5");
  });

  it("builds initials from the first and last name, in any script", () => {
    expect(initialsOf("Nadia Rahman")).toBe("NR");
    expect(initialsOf("Arif")).toBe("A");
    expect(initialsOf("তাসনিম আক্তার")).toBe("তআ");
    expect(initialsOf("  ")).toBe("?");
  });

  it("names an avatar by the person", () => {
    renderWithIntl(<Avatar name="Nadia Rahman" />);
    expect(screen.getByRole("img", { name: "Nadia Rahman" }).textContent).toBe("NR");
  });

  it("keeps the status text next to its colour", () => {
    renderWithIntl(<StatusPill tone="danger">Absent</StatusPill>);
    expect(screen.getByText("Absent").closest("span")?.parentElement?.className).toContain("bg-danger-soft");
    renderWithIntl(<Badge tone="info">New</Badge>);
    expect(screen.getByText("New")).toBeTruthy();
  });

  it("removes a tag by its own button", () => {
    const onRemove = vi.fn();
    renderWithIntl(<Tag onRemove={onRemove}>Physics</Tag>);
    fireEvent.click(screen.getByRole("button", { name: "Remove Physics" }));
    expect(onRemove).toHaveBeenCalledOnce();
  });

  it("renders a card with its heading and actions", () => {
    renderWithIntl(<Card title="Physics 9A" actions={<button>Open</button>}>Body</Card>);
    expect(screen.getByRole("heading", { name: "Physics 9A" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open" })).toBeTruthy();
  });
});
