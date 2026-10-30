import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminSmsCredits from "@/component/Admin/AdminSmsCredits";
import PaymentSuccessContent from "@/component/Payment/PaymentSuccessContent";
import { renderApp } from "@/i18n/test-utils";
import MessageLogTable from "./MessageLogTable";
import SmsCreditsCard from "./SmsCreditsCard";

const get = vi.fn();
const post = vi.fn();
let billingAccess = { role: "TEACHER", canManageBilling: true };
let search = new URLSearchParams();
vi.mock("@/hooks/organization/useBillingAccess", () => ({ default: () => billingAccess }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/billing", useSearchParams: () => search }));
vi.mock("@/lib/axios", () => ({
  default: { get: (...args: unknown[]) => get(...args), post: (...args: unknown[]) => post(...args) },
}));

beforeEach(() => {
  vi.clearAllMocks();
  billingAccess = { role: "TEACHER", canManageBilling: true };
  search = new URLSearchParams();
});
afterEach(() => cleanup());

const summary: SmsCreditSummary = {
  period: "2026-11",
  allowance: { granted: 300, left: 12 },
  top_up: { left: 1500 },
  total_left: 1512,
  low: true,
  packs: [
    { id: "sms_500", credits: 500, price: 300 },
    { id: "sms_1000", credits: 1000, price: 550 },
  ],
};

const message = (overrides: Partial<MessageLogItem> = {}): MessageLogItem => ({
  id: "m-1",
  created_at: "2026-11-02T04:30:00.000Z",
  sent_at: "2026-11-02T04:30:05.000Z",
  event_type: "exam.scheduled",
  channel: "SMS",
  status: "SENT",
  recipient: { id: "s-1", full_name: "Rina Akter" },
  recipient_type: "USER",
  to_address: "01700000000",
  subject: null,
  body: 'Upcoming test "Algebra"',
  credits_used: 1,
  attempts: 1,
  error: null,
  ...overrides,
});

describe("SMS credits (FND-13)", () => {
  it("shows this month's allowance and top-ups in Bangla, and buys a pack by id only", async () => {
    get.mockResolvedValue({ data: { payload: summary } });
    post.mockResolvedValue({ data: { payload: { gatewayPageUrl: "" } } });
    renderApp(<SmsCreditsCard />, { locale: "bn" });

    expect(await screen.findByText("১,৫১২টি SMS বাকি")).toBeTruthy();
    expect(screen.getByText("৩০০টির মধ্যে ১২টি বাকি")).toBeTruthy();
    expect(screen.getByText("কমে আসছে")).toBeTruthy();
    expect(screen.getByText("৳৫৫০")).toBeTruthy();
    expect(get.mock.calls[0][0]).toMatch(/\/sms-credits$/);

    fireEvent.click(screen.getByRole("button", { name: "১,০০০টি SMS কিনুন" }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post.mock.calls[0][0]).toMatch(/\/payments\/sms-top-up$/);
    expect(post.mock.calls[0][1]).toEqual({ packId: "sms_1000" });
  });

  it("is hidden from those who cannot manage billing", () => {
    billingAccess = { role: "TEACHER", canManageBilling: false };
    const { container } = renderApp(<SmsCreditsCard />);
    expect(container.textContent).toBe("");
    expect(get).not.toHaveBeenCalled();
  });

  it("lets a platform admin add credits with a reason", async () => {
    get.mockResolvedValue({ data: { payload: { ...summary, low: false } } });
    post.mockResolvedValue({ data: { payload: { ...summary, top_up: { left: 1750 }, total_left: 1762, low: false } } });
    renderApp(<AdminSmsCredits organizationId="org-1" />);

    expect(await screen.findByText(/1,512 SMS left: 12 of 300 from the plan this month, 1,500 top-up/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Credits to add"), { target: { value: "250" } });
    fireEvent.change(screen.getByLabelText("Reason for the top-up (optional)"), { target: { value: "Bank transfer" } });
    fireEvent.click(screen.getByRole("button", { name: "Add credits" }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post.mock.calls[0][0]).toMatch(/\/sms-credits\/admin\/org-1\/top-ups$/);
    expect(post.mock.calls[0][1]).toEqual({ credits: 250, reason: "Bank transfer" });
    expect(await screen.findByText(/1,762 SMS left/)).toBeTruthy();
  });

  it("shows the credits a paid SMS top-up added", async () => {
    search = new URLSearchParams("tran_id=TT_1");
    get.mockResolvedValue({
      data: { payload: { transactionId: "TT_1", status: "PAID", amount: 550, currency: "BDT", paymentMethod: "bkash", purpose: "SMS_CREDITS", credits: 1000 } },
    });
    renderApp(<PaymentSuccessContent />);
    expect(await screen.findByText("SMS credits")).toBeTruthy();
    expect(screen.getByText("1,000 added")).toBeTruthy();
  });
});

describe("message log (FND-14)", () => {
  it("lists messages with translated type, channel and status, and filters", async () => {
    get.mockResolvedValue({
      data: {
        payload: [
          message(),
          message({ id: "m-2", status: "NO_CREDIT", credits_used: 0, recipient: { id: "s-2", full_name: "Karim" } }),
          message({ id: "m-3", channel: "EMAIL", event_type: "class.invitation", recipient: null, to_address: "parent@example.com", subject: "Join Class 6", body: "<p>x</p>" }),
        ],
        meta: { page: 1, limit: 20, total: 3, total_pages: 1 },
      },
    });
    renderApp(<MessageLogTable />);

    const table = await screen.findByRole("table", { name: "Message log" });
    expect(get.mock.calls[0][0]).toMatch(/\/notifications\/log$/);
    expect(within(table).getAllByText("Test scheduled").length).toBe(2);
    expect(within(table).getByText("Not sent — no credit")).toBeTruthy();
    expect(within(table).getByText("parent@example.com")).toBeTruthy();
    expect(within(table).getByText("Join Class 6")).toBeTruthy();
    expect(within(table).getByText("Class invitation")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "NO_CREDIT" } });
    await waitFor(() => expect(get.mock.calls.at(-1)?.[1]).toEqual({ params: expect.objectContaining({ status: "NO_CREDIT", page: 1 }) }));

    // The table reloads after a filter change.
    const reloaded = await screen.findByRole("table", { name: "Message log" });
    fireEvent.click(within(reloaded).getByRole("button", { name: "Show only messages to Rina Akter" }));
    await waitFor(() => expect(get.mock.calls.at(-1)?.[1]).toEqual({ params: expect.objectContaining({ recipient_id: "s-1" }) }));
    expect(screen.getAllByText("To: Rina Akter").length).toBeGreaterThan(0);
  });
});
