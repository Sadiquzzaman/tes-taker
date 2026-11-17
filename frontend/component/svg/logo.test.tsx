import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import InstructorLogoMarkSVG from "./InstructorLogoMarkSVG";

afterEach(() => cleanup());

/** The new logo (17 Nov 2026) at the size each place asks for, hidden from screen readers (the word beside it names the product). */
describe("Instructor logo", () => {
  it("shows the new logo image at the requested size", () => {
    const { container } = render(<InstructorLogoMarkSVG width={21} />);
    const img = container.querySelector("img") as HTMLImageElement;
    expect(img.getAttribute("src")).toContain("/brand/logo-128.png");
    expect(img.getAttribute("width")).toBe("21");
    expect(img.getAttribute("height")).toBe("21");
    expect(img.getAttribute("alt")).toBe("");
  });
});
