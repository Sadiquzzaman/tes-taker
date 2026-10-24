import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

/** The token-only rule for design/ui (eslint.config.mjs): raw hex colours and pixel font sizes fail CI. */
// Loading the ESLint config takes a few seconds, more when the whole suite runs in parallel.
describe("design/ui lint rule", { timeout: 30_000 }, () => {
  const eslint = new ESLint({ cwd: process.cwd() });
  const lint = async (code: string) => {
    const [result] = await eslint.lintText(code, { filePath: "design/ui/Example.tsx" });
    return result.messages.filter((message) => message.ruleId === "no-restricted-syntax").map((message) => message.message);
  };

  it("rejects hex colours and pixel font sizes", async () => {
    const messages = await lint(
      'export const A = () => <p className="text-[#49734F] text-[14px]" style={{ color: `#fff` }}>x</p>;\n',
    );
    expect(messages.some((message) => message.includes("colour token"))).toBe(true);
    expect(messages.some((message) => message.includes("type scale"))).toBe(true);
  });

  it("accepts token classes", async () => {
    expect(await lint('export const A = () => <p className="text-primary text-body-sm">x</p>;\n')).toEqual([]);
  });
});
