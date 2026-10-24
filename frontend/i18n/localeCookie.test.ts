import { beforeEach, describe, expect, it } from "vitest";
import { applyAccountLocale, readLocaleCookie, writeLocaleCookie } from "./localeCookie";

describe("locale cookie", () => {
  beforeEach(() => {
    document.cookie = "NEXT_LOCALE=; path=/; max-age=0";
  });

  it("stores and reads the language", () => {
    expect(readLocaleCookie()).toBeNull();
    writeLocaleCookie("bn");
    expect(readLocaleCookie()).toBe("bn");
  });

  it("uses the account's language after sign-in", () => {
    writeLocaleCookie("en");

    expect(applyAccountLocale("bn")).toBe(true);
    expect(readLocaleCookie()).toBe("bn");
    // Already the same: nothing to refresh.
    expect(applyAccountLocale("bn")).toBe(false);
  });

  it("keeps the device's language when the account has none (or an unknown one)", () => {
    writeLocaleCookie("bn");

    expect(applyAccountLocale(null)).toBe(false);
    expect(applyAccountLocale(undefined)).toBe(false);
    expect(applyAccountLocale("fr")).toBe(false);
    expect(readLocaleCookie()).toBe("bn");
  });
});
