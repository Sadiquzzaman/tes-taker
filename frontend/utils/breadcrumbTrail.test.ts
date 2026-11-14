import { describe, expect, it } from "vitest";
import { breadcrumbTrail } from "./breadcrumbTrail";

describe("top bar breadcrumb", () => {
  it("links back to the section and the pages in between; the current page is not a link", () => {
    expect(breadcrumbTrail({ label: "Tests", href: "/tests" }, [{ label: "Test details", href: "/tests/e1" }], "Integrity report")).toEqual([
      { label: "Tests", href: "/tests" },
      { label: "Test details", href: "/tests/e1" },
      { label: "Integrity report" },
    ]);
    expect(breadcrumbTrail({ label: "Tests", href: "/tests" }, [], "Create test")).toEqual([{ label: "Tests", href: "/tests" }, { label: "Create test" }]);
  });

  it("makes the last page in between the current one when the page has no name", () => {
    expect(breadcrumbTrail({ label: "Homework", href: "/homework" }, [])).toEqual([{ label: "Homework" }]);
  });
});
