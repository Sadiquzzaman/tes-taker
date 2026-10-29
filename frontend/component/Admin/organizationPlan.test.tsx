import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "@/i18n/test-utils";
import AdminFeatureRequestsTable from "./AdminFeatureRequestsTable";
import AdminOrganizationPlanDrawer, { expiryFromDate } from "./AdminOrganizationPlanDrawer";
import AdminOrganizationsTable from "./AdminOrganizationsTable";

const get = vi.fn();
const post = vi.fn();
const put = vi.fn();
const patch = vi.fn();
const del = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/admin" }));
vi.mock("@/lib/axios", () => ({
  default: {
    get: (...args: unknown[]) => get(...args),
    post: (...args: unknown[]) => post(...args),
    put: (...args: unknown[]) => put(...args),
    patch: (...args: unknown[]) => patch(...args),
    delete: (...args: unknown[]) => del(...args),
  },
}));

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

const organization: AdminOrganizationItem = { id: "org-1", name: "Rina Akter", kind: "SOLO", status: "approved" };

const catalog: FeatureCatalog = {
  features: [
    { key: "allow_model_tests", group: "Question", label: "Model tests" },
    { key: "allow_passage_questions", group: "Question", label: "Passage questions" },
  ],
  limits: [{ key: "max_exams_per_month", label: "Max exams per month" }],
};

const plans = [
  { id: "free", slug: "free", name: "Free", sort_order: 0, price_monthly: 0, price_half_yearly: 0, price_yearly: 0, is_plan_active: true, features: { allow_model_tests: false, allow_passage_questions: false }, limits: { max_exams_per_month: 5 } },
  { id: "pro", slug: "pro", name: "Pro", sort_order: 3, price_monthly: 900, price_half_yearly: 4500, price_yearly: 9000, is_plan_active: true, features: {}, limits: {} },
];

const adminEntitlements = (overrides: FeatureOverrideItem[] = []): AdminOrganizationEntitlements => ({
  organization: { id: "org-1", name: "Rina Akter", kind: "SOLO", status: "approved" },
  entitlements: {
    plan: { id: "free", name: "Free", slug: "free" },
    features: { allow_model_tests: overrides.some((o) => o.key === "allow_model_tests" && o.value === true), allow_passage_questions: false },
    limits: { max_exams_per_month: 5 },
    usage: { exams_used_this_month: 0, total_exams_used: 0 },
  },
  overrides,
});

const mockApi = (overrides: FeatureOverrideItem[] = []) =>
  get.mockImplementation((url: string) =>
    Promise.resolve({
      data: {
        payload: url.endsWith("/entitlements") ? adminEntitlements(overrides) : url.endsWith("/feature-catalog") ? catalog : plans,
      },
    }),
  );

describe("organisation plan & features (FND-07)", () => {
  it("switches a feature on with an end date and reason", async () => {
    mockApi();
    put.mockResolvedValue({ data: {} });
    renderApp(<AdminOrganizationPlanDrawer organization={organization} onClose={() => {}} />);
    const select = await screen.findByLabelText("Switch for Model tests");
    expect((select as HTMLSelectElement).value).toBe("plan");
    expect(screen.getAllByRole("option", { name: "Plan default (Off)" }).length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText("Until (optional)"), { target: { value: "2026-11-30" } });
    fireEvent.change(screen.getByLabelText("Reason (optional)"), { target: { value: "Trial" } });
    fireEvent.change(select, { target: { value: "on" } });
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(put.mock.calls[0][0]).toMatch(/\/subscriptions\/admin\/organizations\/org-1\/overrides\/allow_model_tests$/);
    expect(put.mock.calls[0][1]).toEqual({ value: true, expires_at: expiryFromDate("2026-11-30"), reason: "Trial" });
  });

  it("goes back to the plan by removing the override", async () => {
    mockApi([{ id: "o1", key: "allow_model_tests", value: true, expires_at: null }]);
    del.mockResolvedValue({ data: {} });
    renderApp(<AdminOrganizationPlanDrawer organization={organization} onClose={() => {}} />);
    const select = await screen.findByLabelText("Switch for Model tests");
    expect((select as HTMLSelectElement).value).toBe("on");
    fireEvent.change(select, { target: { value: "plan" } });
    await waitFor(() => expect(del).toHaveBeenCalledTimes(1));
    expect(del.mock.calls[0][0]).toMatch(/\/overrides\/allow_model_tests$/);
  });

  it("sets a limit and assigns a plan to the organisation", async () => {
    mockApi();
    put.mockResolvedValue({ data: {} });
    post.mockResolvedValue({ data: {} });
    renderApp(<AdminOrganizationPlanDrawer organization={organization} onClose={() => {}} />);
    fireEvent.change(await screen.findByLabelText("Limit for Tests per month"), { target: { value: "50" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Tests per month" }));
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(put.mock.calls[0][0]).toMatch(/\/overrides\/max_exams_per_month$/);
    expect(put.mock.calls[0][1]).toEqual({ value: 50, expires_at: undefined, reason: undefined });

    fireEvent.change(screen.getByLabelText("Plan to assign"), { target: { value: "pro" } });
    fireEvent.click(screen.getByRole("button", { name: "Assign plan" }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post.mock.calls[0][1]).toEqual({ organization_id: "org-1", plan_id: "pro", billing_cycle: "MONTHLY" });
  });

  it("lists solo teachers' workspaces and opens their plan", async () => {
    get.mockImplementation((url: string, config?: { params?: Record<string, unknown> }) =>
      Promise.resolve({
        data: url.endsWith("/organizations/admin")
          ? { payload: config?.params?.kind === "SOLO" ? [{ ...organization, owner: { full_name: "Rina Akter" } }] : [], meta: { total_pages: 1 } }
          : { payload: url.endsWith("/entitlements") ? adminEntitlements() : url.endsWith("/feature-catalog") ? catalog : plans },
      }),
    );
    renderApp(<AdminOrganizationsTable />);
    fireEvent.change(await screen.findByLabelText("Show"), { target: { value: "SOLO" } });
    const row = (await screen.findAllByText("Rina Akter"))[0].closest("tr") as HTMLElement;
    expect(get).toHaveBeenCalledWith(expect.stringMatching(/\/organizations\/admin$/), { params: expect.objectContaining({ kind: "SOLO", status: undefined }) });
    fireEvent.click(within(row).getByRole("button", { name: "Plan & features" }));
    expect(await screen.findByText("Plan & features: Rina Akter")).toBeTruthy();
  });
});

describe("feature requests (FND-08)", () => {
  it("lists open requests and marks one handled", async () => {
    get.mockResolvedValue({
      data: {
        payload: [
          {
            id: "r1",
            organization_id: "org-1",
            feature_key: "allow_passage_questions",
            note: "For reading tests",
            status: "OPEN",
            created_at: "2026-10-28T10:00:00.000Z",
            handled_at: null,
            organization: { id: "org-1", name: "Rina Akter", kind: "SOLO" },
            user: { id: "u1", full_name: "Rina Akter", email: "rina@example.com" },
          },
        ],
      },
    });
    patch.mockResolvedValue({ data: {} });
    renderApp(<AdminFeatureRequestsTable />);
    expect((await screen.findAllByText("Passage questions")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("For reading tests").length).toBeGreaterThan(0);
    expect(get.mock.calls[0][1]).toEqual({ params: { status: "OPEN" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Mark handled" })[0]);
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(1));
    expect(patch.mock.calls[0][0]).toMatch(/\/subscriptions\/admin\/feature-requests\/r1\/handled$/);
  });
});
