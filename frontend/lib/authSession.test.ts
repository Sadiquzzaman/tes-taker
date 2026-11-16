import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LOCALE_COOKIE } from "@/i18n/config";
import { readLocaleCookie } from "@/i18n/localeCookie";
import { clearAuthSession, persistAuthSession } from "./authSession";

const post = vi.fn();
const patch = vi.fn();
vi.mock("axios", () => ({ default: { post: (...args: unknown[]) => post(...args), patch: (...args: unknown[]) => patch(...args) } }));

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
    patch.mockReset().mockResolvedValue({ status: 200 });
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

  it("keeps this device's language when neither is set, and saves it on the account for notifications", async () => {
    await expect(persistAuthSession(session(null, null))).resolves.toBe(false);
    expect(readLocaleCookie()).toBe("bn");
    await vi.waitFor(() => expect(patch).toHaveBeenCalledWith(expect.stringMatching(/\/user\/me\/locale$/), { locale: "bn" }, { headers: { Authorization: "Bearer token" } }));
    expect(JSON.parse(localStorage.getItem("user") ?? "{}").locale).toBe("bn");
  });

  it("does not save a language the account or the organisation already sets", async () => {
    await persistAuthSession(session("bn", "en"));
    await persistAuthSession(session(null, "en"));
    expect(patch).not.toHaveBeenCalled();
  });
});

/** PM-01: logging out ends this device on the server, then clears the browser. */
describe("logout", () => {
  beforeEach(() => {
    post.mockReset().mockResolvedValue({ status: 200 });
    // jsdom cannot follow the redirect to /login and says so on the console.
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("signs this device out with its refresh token before clearing the session", async () => {
    localStorage.setItem("user", JSON.stringify(session(null, null)));
    await clearAuthSession();
    expect(post).toHaveBeenNthCalledWith(1, expect.stringMatching(/\/auth\/logout$/), { refreshToken: "refresh" });
    expect(post).toHaveBeenNthCalledWith(2, "/session/logout");
    expect(localStorage.getItem("user")).toBeNull();
  });

  it("still clears the browser when the server cannot be reached or there is no token", async () => {
    localStorage.setItem("user", JSON.stringify(session(null, null)));
    post.mockRejectedValueOnce(new Error("offline"));
    await clearAuthSession();
    expect(localStorage.getItem("user")).toBeNull();

    post.mockClear();
    await clearAuthSession();
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith("/session/logout");
  });
});
