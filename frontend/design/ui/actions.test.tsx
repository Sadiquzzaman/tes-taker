import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/i18n/test-utils";
import Button, { buttonClasses } from "./Button";
import IconButton from "./IconButton";
import Link from "./Link";
import { SearchIcon } from "./icons";

afterEach(() => cleanup());

describe("Button", () => {
  it("is a non-submitting button by default and runs onClick", () => {
    const onClick = vi.fn();
    renderWithIntl(<Button onClick={onClick}>Save</Button>);

    const button = screen.getByRole("button", { name: "Save" });
    expect(button.getAttribute("type")).toBe("button");
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("is busy and cannot be clicked while loading", () => {
    const onClick = vi.fn();
    renderWithIntl(
      <Button loading onClick={onClick}>
        Saving
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Saving" });
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("uses token classes for each variant", () => {
    expect(buttonClasses({ variant: "danger" })).toContain("bg-danger");
    expect(buttonClasses({ variant: "secondary", fullWidth: true })).toContain("w-full");
  });
});

describe("IconButton and Link", () => {
  it("names an icon-only button for screen readers", () => {
    renderWithIntl(<IconButton label="Search" icon={<SearchIcon />} />);
    expect(screen.getByRole("button", { name: "Search" })).toBeTruthy();
  });

  it("opens external links safely in a new tab", () => {
    renderWithIntl(
      <Link href="https://example.com" external>
        Docs
      </Link>,
    );
    const link = screen.getByRole("link", { name: "Docs" });
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });
});
