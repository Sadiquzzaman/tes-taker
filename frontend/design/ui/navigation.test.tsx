import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/i18n/test-utils";
import Breadcrumb from "./Breadcrumb";
import Pagination, { pageWindow } from "./Pagination";
import Stepper from "./Stepper";
import Tabs from "./Tabs";

afterEach(() => cleanup());

describe("Pagination", () => {
  it("keeps the first, last and nearby pages", () => {
    expect(pageWindow(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(pageWindow(6, 12)).toEqual([1, "gap", 5, 6, 7, "gap", 12]);
    expect(pageWindow(1, 12)).toEqual([1, 2, "gap", 12]);
  });

  it("marks the current page and moves between pages", () => {
    const onPageChange = vi.fn();
    renderWithIntl(<Pagination page={1} pageCount={3} onPageChange={onPageChange} />);

    expect(screen.getByRole("button", { name: "Page 1" }).getAttribute("aria-current")).toBe("page");
    expect((screen.getByRole("button", { name: "Previous page" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("uses Bangla digits on a Bangla page and hides itself for one page", () => {
    renderWithIntl(<Pagination page={2} pageCount={3} onPageChange={() => {}} />, "bn");
    expect(screen.getByRole("button", { name: "পাতা ২" })).toBeTruthy();
    cleanup();
    const { container } = renderWithIntl(<Pagination page={1} pageCount={1} onPageChange={() => {}} />);
    expect(container.innerHTML).toBe("");
  });
});

describe("Breadcrumb and Stepper", () => {
  it("links the parents and marks the current page", () => {
    renderWithIntl(<Breadcrumb items={[{ label: "Classes", href: "/classes" }, { label: "Physics 9A" }]} />);
    expect(screen.getByRole("link", { name: "Classes" }).getAttribute("href")).toBe("/classes");
    expect(screen.getByText("Physics 9A").getAttribute("aria-current")).toBe("page");
  });

  it("marks the current step and the finished ones", () => {
    renderWithIntl(<Stepper steps={["Session", "Levels", "Classes"]} current={1} />);
    expect(screen.getAllByText("Done")).toHaveLength(1);
    expect(document.querySelector('[aria-current="step"]')?.textContent).toContain("Levels");
    expect(screen.getByText("Step 2 of 3:", { exact: false })).toBeTruthy();
  });
});

describe("Tabs", () => {
  it("shows one panel at a time and switches on click", () => {
    const onChange = vi.fn();
    renderWithIntl(
      <Tabs
        onChange={onChange}
        tabs={[
          { key: "overview", label: "Overview", content: <p>Overview panel</p> },
          { key: "students", label: "Students", content: <p>Students panel</p> },
        ]}
      />,
    );

    expect(screen.getByRole("tab", { name: "Overview" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("Overview panel")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Students" }));
    expect(screen.getByText("Students panel")).toBeTruthy();
    expect(onChange).toHaveBeenCalledWith("students");
  });
});
