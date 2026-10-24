import { describe, expect, it } from "vitest";
import bn from "@/messages/bn.json";
import en from "@/messages/en.json";

type Tree = { [key: string]: string | Tree };

const flatten = (tree: Tree, prefix = ""): Record<string, string> =>
  Object.entries(tree).reduce<Record<string, string>>((all, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === "string" ? { ...all, [path]: value } : { ...all, ...flatten(value, path) };
  }, {});

const english = flatten(en);
const bangla = flatten(bn);

/** Argument names ({name}, {count, plural, …}) and rich-text tags (<b>…</b>) a message uses. */
const slots = (message: string) => {
  // Argument names start lower-case; this skips one-word select branches such as "{Password}".
  const args = [...message.matchAll(/\{\s*([a-z]\w*)\s*[,}]/g)].map((match) => match[1]);
  const tags = [...message.matchAll(/<(\w+)>/g)].map((match) => `<${match[1]}>`);
  return [...new Set([...args, ...tags])].sort();
};

// Bangla messages that are meant to have no Bangla letters.
const LATIN_IN_BANGLA = new Set(["language.switchTo"]);

describe("messages", () => {
  it("has the same keys in Bangla and English", () => {
    expect(Object.keys(bangla).sort()).toEqual(Object.keys(english).sort());
  });

  it("has no empty messages", () => {
    for (const [key, value] of [...Object.entries(english), ...Object.entries(bangla)]) {
      expect(value.trim(), key).not.toBe("");
    }
  });

  it("uses the same placeholders and tags in both languages", () => {
    for (const key of Object.keys(english)) {
      expect(slots(bangla[key] ?? ""), key).toEqual(slots(english[key]));
    }
  });

  it("is actually translated into Bangla", () => {
    for (const [key, value] of Object.entries(bangla)) {
      if (!LATIN_IN_BANGLA.has(key)) {
        expect(value, key).toMatch(/[ঀ-৿]/);
      }
    }
  });

  it("does not use '.' in keys (next-intl reads it as nesting)", () => {
    const keysOf = (tree: Tree): string[] =>
      Object.entries(tree).flatMap(([key, value]) => (typeof value === "string" ? [key] : [key, ...keysOf(value)]));
    expect(keysOf(en).filter((key) => key.includes("."))).toEqual([]);
  });
});
