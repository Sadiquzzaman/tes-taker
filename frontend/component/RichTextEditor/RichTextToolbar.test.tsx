import type { Editor } from "@tiptap/react";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/i18n/test-utils";
import RichTextToolbar from "./RichTextToolbar";

// A stand-in editor: every chained command is recorded, and only bold is active.
const makeEditor = () => {
  const calls: string[] = [];
  const chain: Record<string, unknown> = new Proxy(
    {},
    {
      get: (_target, key: string) => (...args: unknown[]) => {
        calls.push(args.length ? `${key}(${JSON.stringify(args[0])})` : key);
        return chain;
      },
    },
  );
  const editor = {
    on: vi.fn(),
    off: vi.fn(),
    isActive: (name: string) => name === "bold",
    getAttributes: () => ({}),
    chain: () => chain,
  } as unknown as Editor;
  return { editor, calls };
};

afterEach(() => cleanup());

describe("rich text toolbar", () => {
  it("names every button and says which formats are on, in Bangla", () => {
    const { editor } = makeEditor();
    renderWithIntl(<RichTextToolbar editor={editor} variant="lite" />, "bn");
    expect(screen.getByRole("toolbar", { name: "নির্দেশনার ফরম্যাট" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "বোল্ড" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "ইটালিক" }).getAttribute("aria-pressed")).toBe("false");
    // Commands are not toggles, so they carry no pressed state.
    expect(screen.getByRole("button", { name: "আগের অবস্থায় ফিরুন" }).getAttribute("aria-pressed")).toBeNull();
  });

  it("runs the formatting command", () => {
    const { editor, calls } = makeEditor();
    renderWithIntl(<RichTextToolbar editor={editor} />);
    fireEvent.click(screen.getByRole("button", { name: "Italic" }));
    expect(calls).toEqual(["focus", "toggleItalic", "run"]);
    expect(screen.getByRole("combobox", { name: "Text style" })).toBeTruthy();
  });
});
