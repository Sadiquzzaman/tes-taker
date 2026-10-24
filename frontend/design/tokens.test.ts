import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { compile } from "tailwindcss";
import { describe, expect, it } from "vitest";
import tokens from "./tokens.json";

const frontendRoot = resolve(__dirname, "..");
const colors = tokens.color as Record<string, { value: string }>;

/** WCAG 2.x relative luminance and contrast ratio. */
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (foreground: string, background: string) => {
  const [light, dark] = [luminance(colors[foreground].value), luminance(colors[background].value)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
};

/** Every text colour on every background it is meant to be used on (WCAG AA for normal text: 4.5:1). */
const TEXT_PAIRS: Array<[string, string]> = [
  ["ink", "surface"],
  ["ink", "canvas"],
  ["ink", "primary-soft"],
  ["ink-muted", "surface"],
  ["ink-muted", "canvas"],
  ["ink-muted", "primary-soft"],
  ["ink-inverse", "primary"],
  ["ink-inverse", "primary-hover"],
  ["ink-inverse", "danger"],
  ["primary", "surface"],
  ["primary", "canvas"],
  ["primary", "primary-soft"],
  ...(["success", "warning", "danger", "info"].flatMap((status) => [
    [status, `${status}-soft`],
    [status, "surface"],
  ]) as Array<[string, string]>),
];

describe("design tokens", () => {
  it.each(TEXT_PAIRS)("%s text on %s meets WCAG AA (4.5:1)", (foreground, background) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps app/tokens.css in sync with design/tokens.json", () => {
    // Throws (non-zero exit) when the generated file is stale.
    expect(() => execFileSync("node", ["scripts/build-tokens.mjs", "--check"], { cwd: frontendRoot, stdio: "pipe" })).not.toThrow();
  });

  it("exposes every colour, radius and shadow token to Tailwind", () => {
    const css = readFileSync(resolve(frontendRoot, "app/tokens.css"), "utf8");

    for (const name of Object.keys(colors)) expect(css).toContain(`--color-${name}:`);
    for (const name of Object.keys(tokens.radius)) expect(css).toContain(`--radius-${name}:`);
    for (const name of Object.keys(tokens.shadow)) expect(css).toContain(`--shadow-${name}:`);
    expect(css).toMatch(/--font-sans: "Instrument Sans", "Hind Siliguri"/);
  });

  it("uses the 6-step type scale from the spec (12/14/16/20/24/32 px)", () => {
    expect(Object.values(tokens.text).map((step) => step.size)).toEqual(["12px", "14px", "16px", "20px", "24px", "32px"]);
  });

  it("turns the tokens into Tailwind classes", async () => {
    const theme = readFileSync(resolve(frontendRoot, "app/tokens.css"), "utf8");
    const compiler = await compile(`${theme}\n@tailwind utilities;`, { base: frontendRoot });
    const css = compiler.build([
      "bg-primary",
      "text-ink-muted",
      "bg-canvas",
      "border-border",
      "bg-warning-soft",
      "rounded-card",
      "rounded-sheet",
      "shadow-card",
      "text-body",
      "font-bangla",
      "ease-fast",
    ]);

    expect(css).toMatch(/\.bg-primary\s*\{\s*background-color: var\(--color-primary\)/);
    expect(css).toMatch(/\.text-ink-muted\s*\{\s*color: var\(--color-ink-muted\)/);
    expect(css).toMatch(/\.rounded-card\s*\{\s*border-radius: var\(--radius-card\)/);
    expect(css).toMatch(/\.text-body\s*\{\s*font-size: var\(--text-body\);\s*line-height: var\(--tw-leading, var\(--text-body--line-height\)\)/);
    for (const cls of ["bg-canvas", "border-border", "bg-warning-soft", "rounded-sheet", "shadow-card", "font-bangla", "ease-fast"]) {
      expect(css).toContain(`.${cls}`);
    }
  });
});
