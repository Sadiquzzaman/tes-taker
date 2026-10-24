import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/i18n/test-utils";
import LanguageSwitcher from "./LanguageSwitcher";

const refresh = vi.fn();
const patch = vi.fn();
const triggerToast = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/axios", () => ({ default: { patch: (...args: unknown[]) => patch(...args) } }));
vi.mock("@/component/Toast/ToastContext", () => ({ useToast: () => ({ triggerToast }) }));

const clearCookie = () => {
  document.cookie = "NEXT_LOCALE=; path=/; max-age=0";
};

describe("LanguageSwitcher", () => {
  beforeEach(() => {
    clearCookie();
    localStorage.clear();
    refresh.mockReset();
    patch.mockReset().mockResolvedValue({ data: {} });
    triggerToast.mockReset();
  });
  afterEach(() => cleanup());

  it("offers Bangla on an English page and switches this device to it", async () => {
    renderWithIntl(<LanguageSwitcher />, "en");

    fireEvent.click(screen.getByRole("button", { name: "Switch language to Bangla" }));

    expect(document.cookie).toContain("NEXT_LOCALE=bn");
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    // Not signed in: nothing to save on an account.
    expect(patch).not.toHaveBeenCalled();
  });

  it("offers English on a Bangla page", () => {
    renderWithIntl(<LanguageSwitcher />, "bn");

    expect(screen.getByRole("button", { name: "ভাষা ইংরেজিতে বদলান" }).textContent).toContain("English");
  });

  it("saves the choice to the account when signed in", async () => {
    localStorage.setItem("user", JSON.stringify({ access_token: "test-token", locale: null }));
    renderWithIntl(<LanguageSwitcher />, "bn");

    fireEvent.click(screen.getByRole("button"));

    expect(document.cookie).toContain("NEXT_LOCALE=en");
    await waitFor(() => expect(patch).toHaveBeenCalledWith(expect.stringMatching(/\/user\/me\/locale$/), { locale: "en" }));
    await waitFor(() => expect(JSON.parse(localStorage.getItem("user") ?? "{}").locale).toBe("en"));
  });

  it("keeps the device's choice and says so when saving to the account fails", async () => {
    localStorage.setItem("user", JSON.stringify({ access_token: "test-token" }));
    patch.mockRejectedValue(new Error("offline"));
    renderWithIntl(<LanguageSwitcher />, "en");

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => expect(triggerToast).toHaveBeenCalledWith(expect.objectContaining({ type: "error" })));
    expect(document.cookie).toContain("NEXT_LOCALE=bn");
  });
});
