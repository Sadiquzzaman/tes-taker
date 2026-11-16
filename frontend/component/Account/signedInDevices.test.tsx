import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "@/i18n/test-utils";
import SignedInDevices, { type SignedInDevice } from "./SignedInDevices";

const get = vi.fn();
const post = vi.fn();
const del = vi.fn();
vi.mock("@/lib/axios", () => ({
  default: {
    get: (...args: unknown[]) => get(...args),
    post: (...args: unknown[]) => post(...args),
    delete: (...args: unknown[]) => del(...args),
  },
}));

const device = (overrides: Partial<SignedInDevice>): SignedInDevice => ({
  id: "d1",
  platform: "WEB",
  device_name: "Chrome on Windows",
  app_version: null,
  created_at: "2026-11-10T04:00:00Z",
  last_used_at: "2026-11-17T04:00:00Z",
  current: false,
  ...overrides,
});

let devices: SignedInDevice[];

beforeEach(() => {
  vi.clearAllMocks();
  devices = [
    device({ id: "here", current: true }),
    device({ id: "phone", platform: "ANDROID", device_name: "Pixel 8", app_version: "1.0.0" }),
    device({ id: "old", platform: "WEB", device_name: null }),
  ];
  get.mockImplementation(() => Promise.resolve({ data: { payload: devices } }));
  del.mockImplementation((url: string) => {
    devices = devices.filter((d) => !url.endsWith(`/auth/sessions/${d.id}`));
    return Promise.resolve({ data: {} });
  });
  post.mockImplementation(() => {
    const count = devices.filter((d) => !d.current).length;
    devices = devices.filter((d) => d.current);
    return Promise.resolve({ data: { payload: { signed_out: count } } });
  });
});
afterEach(() => cleanup());

/** PM-01: the account's signed-in devices, with signing out one or all the others. */
describe("signed-in devices", () => {
  it("lists the devices with this one marked and no sign-out button on it", async () => {
    renderApp(<SignedInDevices />);
    const list = await screen.findByRole("list", { name: "Signed-in devices" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(within(items[0]).getByText("This device")).toBeTruthy();
    expect(within(items[0]).queryByRole("button", { name: "Sign out" })).toBeNull();
    expect(within(items[1]).getByText("Pixel 8")).toBeTruthy();
    expect(within(items[1]).getByText(/Android app · version 1\.0\.0 · last used/)).toBeTruthy();
    // A browser without a name shows its kind.
    expect(within(items[2]).getAllByText(/Web browser/).length).toBeGreaterThan(0);
  });

  it("signs out one device after asking", async () => {
    renderApp(<SignedInDevices />);
    const list = await screen.findByRole("list", { name: "Signed-in devices" });
    fireEvent.click(within(within(list).getAllByRole("listitem")[1]).getByRole("button", { name: "Sign out" }));
    expect(await screen.findByText("Sign out of Pixel 8?")).toBeTruthy();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(del).toHaveBeenCalledWith(expect.stringMatching(/\/auth\/sessions\/phone$/)));
    expect(await screen.findByText("The device was signed out.")).toBeTruthy();
    await waitFor(() => expect(within(screen.getByRole("list", { name: "Signed-in devices" })).getAllByRole("listitem")).toHaveLength(2));
  });

  it("signs out all the other devices, in Bangla", async () => {
    renderApp(<SignedInDevices />, { locale: "bn" });
    fireEvent.click(await screen.findByRole("button", { name: "অন্য সব ডিভাইস থেকে সাইন আউট" }));
    expect(await screen.findByText("অন্য ২টি ডিভাইস থেকে সাইন আউট করবেন?")).toBeTruthy();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "সাইন আউট" }));
    await waitFor(() => expect(post).toHaveBeenCalledWith(expect.stringMatching(/\/auth\/sessions\/revoke-others$/), {}));
    expect(await screen.findByText("২টি ডিভাইস থেকে সাইন আউট করা হয়েছে।")).toBeTruthy();
    expect(await screen.findByText("শুধু এই ডিভাইসে সাইন ইন করা আছে।")).toBeTruthy();
  });

  it("offers a retry when the list cannot load", async () => {
    get.mockRejectedValueOnce(new Error("offline"));
    renderApp(<SignedInDevices />);
    expect(await screen.findByText("Couldn't load your devices.")).toBeTruthy();
  });
});
