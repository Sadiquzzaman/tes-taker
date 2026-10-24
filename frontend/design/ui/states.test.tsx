import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/i18n/test-utils";
import EmptyState from "./EmptyState";
import ErrorState from "./ErrorState";
import Skeleton from "./Skeleton";

afterEach(() => cleanup());

describe("states", () => {
  it("offers a retry when loading failed", () => {
    const onRetry = vi.fn();
    renderWithIntl(<ErrorState description="The class list did not load." onRetry={onRetry} />, "bn");

    expect(screen.getByRole("alert").textContent).toContain("কিছু একটা সমস্যা হয়েছে");
    fireEvent.click(screen.getByRole("button", { name: "আবার চেষ্টা করুন" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("shows one next step when empty", () => {
    renderWithIntl(<EmptyState title="No exams yet" action={<button>Create exam</button>} />);
    expect(screen.getByText("No exams yet")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Create exam" })).toBeTruthy();
  });

  it("hides skeletons from screen readers", () => {
    const { container } = renderWithIntl(<Skeleton lines={3} />);
    expect(container.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
    expect(container.firstElementChild?.children).toHaveLength(3);
  });
});
