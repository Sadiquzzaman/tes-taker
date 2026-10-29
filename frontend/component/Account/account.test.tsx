import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PaymentResult from "@/component/Payment/PaymentResult";
import PaymentSuccessContent from "@/component/Payment/PaymentSuccessContent";
import { PasswordInput } from "@/design/ui";
import { renderApp } from "@/i18n/test-utils";
import AccountBilling, { getPlanState } from "./AccountBilling";
import TeacherRequestPanel from "./TeacherRequestPanel";

const get = vi.fn();
const post = vi.fn();
let search = new URLSearchParams();
let billingAccess = { role: "TEACHER", canManageBilling: true };
vi.mock("@/hooks/organization/useBillingAccess", () => ({ default: () => billingAccess }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/account", useSearchParams: () => search }));
vi.mock("@/lib/axios", () => ({
  default: { get: (...args: unknown[]) => get(...args), post: (...args: unknown[]) => post(...args) },
}));

beforeEach(() => {
  vi.clearAllMocks();
  search = new URLSearchParams();
  billingAccess = { role: "TEACHER", canManageBilling: true };
});
afterEach(() => cleanup());

const plan = (slug: string, sort_order: number, price_monthly: number) =>
  ({ id: slug, slug, name: slug.toUpperCase(), sort_order, price_monthly, price_half_yearly: price_monthly * 5, price_yearly: price_monthly * 10, is_plan_active: true }) as SubscriptionPlan;

describe("billing", () => {
  it("only offers plans above the current one", () => {
    expect(getPlanState(plan("pro", 2, 500), 2, "pro")).toBe("current");
    expect(getPlanState(plan("basic", 1, 200), 2, "pro")).toBe("downgrade");
    expect(getPlanState(plan("max", 3, 900), 2, "pro")).toBe("upgrade");
  });

  it("shows usage and prices in Bangla digits, and upgrades without sending a price", async () => {
    get.mockImplementation((url: string) =>
      Promise.resolve({
        data: {
          payload: url.endsWith("/me/entitlements")
            ? { plan: { id: "p", name: "Basic", slug: "basic" }, features: {}, limits: { max_exams_per_month: 10 }, usage: { exams_used_this_month: 3, total_exams_used: 12 } }
            : [plan("basic", 1, 200), plan("pro", 2, 500)],
        },
      }),
    );
    post.mockResolvedValueOnce({ data: { payload: { id: "sub-1" } } }).mockResolvedValueOnce({ data: { payload: {} } });
    renderApp(<AccountBilling />, { locale: "bn" });
    expect(await screen.findByText("১০টির মধ্যে ৩টি")).toBeTruthy();
    expect(await screen.findByText("৳৫০০")).toBeTruthy();
    expect(screen.getByText("বর্তমান প্ল্যান")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "আপগ্রেড করুন" }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect(post.mock.calls[0][1]).toEqual({ plan_id: "pro", billing_cycle: "MONTHLY" });
    expect(post.mock.calls[1][1]).toEqual({ subscriptionId: "sub-1" });
  });

  it("shows a school teacher the workspace's plan, but no plans to buy", async () => {
    billingAccess = { role: "TEACHER", canManageBilling: false };
    get.mockImplementation((url: string) =>
      Promise.resolve({
        data: {
          payload: url.endsWith("/me/entitlements")
            ? { plan: { id: "p", name: "Pro", slug: "pro" }, features: {}, limits: {}, usage: { exams_used_this_month: 1, total_exams_used: 4 } }
            : [plan("basic", 1, 200), plan("max", 3, 900)],
        },
      }),
    );
    renderApp(<AccountBilling />);
    expect(await screen.findByText(/Only the workspace owner or an admin can change the plan/)).toBeTruthy();
    expect(screen.getByText("Pro")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Upgrade" })).toBeNull();
    expect(screen.getByRole("link", { name: "See all features" }).getAttribute("href")).toBe("/features");
  });
});

describe("teacher request", () => {
  it("lets a student ask again after a rejection", async () => {
    get.mockResolvedValue({ data: { payload: { id: "r1", status: "rejected", created_at: "2026-10-01T00:00:00.000Z" } } });
    post.mockResolvedValue({ data: { payload: { id: "r2", status: "pending", created_at: "2026-10-25T00:00:00.000Z" } } });
    renderApp(<TeacherRequestPanel />);
    expect(await screen.findByText("Rejected")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ask again" }));
    expect(await screen.findByText("Waiting for review")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Ask again" })).toBeNull();
  });
});

describe("password field", () => {
  it("shows and hides the password", () => {
    renderApp(<PasswordInput label="Current password" />);
    const input = screen.getByLabelText("Current password") as HTMLInputElement;
    expect(input.type).toBe("password");
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(input.type).toBe("text");
    expect(screen.getByRole("button", { name: "Hide password" })).toBeTruthy();
  });
});

describe("payment result", () => {
  it("shows the outcome and the way back, in Bangla", () => {
    renderApp(<PaymentResult tone="danger" title="পেমেন্ট হয়নি" detail="d" action={{ href: "/account", label: "বিলিংয়ে ফিরুন" }} />, { locale: "bn" });
    expect(screen.getByRole("heading", { name: "পেমেন্ট হয়নি" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "বিলিংয়ে ফিরুন" }).getAttribute("href")).toBe("/account");
  });

  it("confirms a paid payment with the server", async () => {
    search = new URLSearchParams("tran_id=T1");
    get.mockResolvedValue({ data: { payload: { transactionId: "T1", status: "PAID", amount: 500, currency: "BDT", paymentMethod: "bKash" } } });
    renderApp(<PaymentSuccessContent />);
    expect(await screen.findByRole("heading", { name: "Payment successful" })).toBeTruthy();
    expect(screen.getByText("BDT 500.00")).toBeTruthy();
    expect(get.mock.calls[0][0]).toMatch(/\/payments\/T1$/);
  });

  it("asks the visitor to log in when the payment belongs to someone else", async () => {
    search = new URLSearchParams("tran_id=T1");
    get.mockRejectedValue(Object.assign(new Error("nope"), { isAxiosError: true, response: { status: 404 } }));
    renderApp(<PaymentSuccessContent />);
    expect(await screen.findByText("Log in with the account that made this payment to see its status.")).toBeTruthy();
  });

  it("says so when the link has no reference", () => {
    renderApp(<PaymentSuccessContent />);
    expect(screen.getByText("This link has no payment reference.")).toBeTruthy();
    expect(get).not.toHaveBeenCalled();
  });
});
