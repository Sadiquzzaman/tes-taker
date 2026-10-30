import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LOCALE_COOKIE } from "@/i18n/config";
import { readLocaleCookie } from "@/i18n/localeCookie";
import { persistAuthSession } from "./authSession";

const post = vi.fn();
vi.mock("axios", () => ({ default: { post: (...args: unknown[]) => post(...args) } }));

const session = (locale: "bn" | "en" | null, defaultLocale: "bn" | "en" | null) =>
  ({
    id: "u1",
    access_token: "token",
    refresh_token: "refresh",
    role: "TEACHER",
    session_mode: "organization",
    locale,
    organization: { id: "org-1", name: "Green School", organization_number: 100001, role: "TEACHER", status: "approved", default_locale: defaultLocale },
  }) as unknown as LoginResponsePayload;

/** FND-18: after sign-in, the user's language wins; without one, the organisation's language is used. */
describe("language after sign-in", () => {
  beforeEach(() => {
    post.mockResolvedValue({ status: 200 });
    document.cookie = `${LOCALE_COOKIE}=bn; path=/`;
  });

  afterEach(() => {
    document.cookie = `${LOCALE_COOKIE}=; path=/; max-age=0`;
    localStorage.clear();
  });

  it("uses the organisation's language when the user has not chosen one", async () => {
    await expect(persistAuthSession(session(null, "en"))).resolves.toBe(true);
    expect(readLocaleCookie()).toBe("en");
  });

  it("keeps the user's own language over the organisation's", async () => {
    await expect(persistAuthSession(session("bn", "en"))).resolves.toBe(false);
    expect(readLocaleCookie()).toBe("bn");
  });

  it("keeps this device's language when neither is set", async () => {
    await expect(persistAuthSession(session(null, null))).resolves.toBe(false);
    expect(readLocaleCookie()).toBe("bn");
  });
});
