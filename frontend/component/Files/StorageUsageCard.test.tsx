import { cleanup, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "@/i18n/test-utils";
import StorageUsageCard from "./StorageUsageCard";

const get = vi.fn();
let billingAccess = { role: "TEACHER", canManageBilling: true };
vi.mock("@/hooks/organization/useBillingAccess", () => ({ default: () => billingAccess }));
vi.mock("@/lib/axios", () => ({ default: { get: (...args: unknown[]) => get(...args) } }));

const MB = 1024 * 1024;
const usage = (overrides: Partial<StorageUsage> = {}): StorageUsage => ({
  used_bytes: 460 * MB,
  limit_bytes: 500 * MB,
  percent: 92,
  warning: true,
  full: false,
  by_type: { homework: 300 * MB, resources: 100 * MB, video: 0, other: 60 * MB },
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  billingAccess = { role: "TEACHER", canManageBilling: true };
});
afterEach(() => cleanup());

describe("StorageUsageCard (FND-16)", () => {
  it("shows storage used against the plan by type, with a warning from 90%", async () => {
    get.mockResolvedValue({ data: { payload: usage() } });
    renderApp(<StorageUsageCard />);

    expect(await screen.findByText("460 MB of 500 MB used")).toBeTruthy();
    expect(screen.getByText("92% used")).toBeTruthy();
    expect(screen.getByText("Almost full. At 100% uploads stop.")).toBeTruthy();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("92");
    expect(screen.getByText("Homework").nextElementSibling?.textContent).toBe("300 MB");
    expect(screen.getByText("Video").nextElementSibling?.textContent).toBe("0 byte");
    expect(get.mock.calls[0][0]).toMatch(/\/files\/usage$/);
  });

  it("says uploads are blocked when storage is full, in Bangla", async () => {
    get.mockResolvedValue({ data: { payload: usage({ used_bytes: 500 * MB, percent: 100, full: true }) } });
    renderApp(<StorageUsageCard />, { locale: "bn" });

    expect(await screen.findByText("৫০০ MB-এর মধ্যে ৫০০ MB ব্যবহৃত")).toBeTruthy();
    expect(screen.getByText("স্টোরেজ পূর্ণ। আরও আপলোড করতে ফাইল মুছুন বা প্ল্যান আপগ্রেড করুন।")).toBeTruthy();
  });

  it("shows use without a bar when the plan has no limit", async () => {
    get.mockResolvedValue({ data: { payload: usage({ limit_bytes: 0, percent: 0, warning: false, used_bytes: 2 * MB }) } });
    renderApp(<StorageUsageCard />);

    expect(await screen.findByText("2 MB used — your plan has no storage limit")).toBeTruthy();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("is hidden from those who cannot manage billing", () => {
    billingAccess = { role: "TEACHER", canManageBilling: false };
    const { container } = renderApp(<StorageUsageCard />);
    expect(container.textContent).toBe("");
    expect(get).not.toHaveBeenCalled();
  });
});
