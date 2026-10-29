import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import type { AxiosError } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EntitlementsContext, type EntitlementsState } from "@/hooks/api/subscription/useEntitlements";
import { useApiError } from "@/hooks/api/useApiError";
import { renderApp } from "@/i18n/test-utils";
import FeatureNavGate from "./FeatureNavGate";
import LockedFeatureProvider from "./LockedFeatureProvider";
import MoreFeatures from "./MoreFeatures";
import UpgradeLink from "./UpgradeLink";

const get = vi.fn();
const post = vi.fn();
let billingAccess = { role: "TEACHER", canManageBilling: true };
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/tests", useSearchParams: () => new URLSearchParams() }));
vi.mock("@/lib/axios", () => ({
  default: { get: (...args: unknown[]) => get(...args), post: (...args: unknown[]) => post(...args) },
}));
vi.mock("@/hooks/organization/useBillingAccess", () => ({ default: () => billingAccess }));

beforeEach(() => {
  vi.clearAllMocks();
  billingAccess = { role: "TEACHER", canManageBilling: true };
});
afterEach(() => cleanup());

const entitlementsState = (features: Record<string, boolean>, loading = false): EntitlementsState => ({
  entitlements: { plan: { id: "p", name: "Basic", slug: "basic" }, features, limits: {}, usage: { exams_used_this_month: 0, total_exams_used: 0 } },
  loading,
  error: null,
  hasFeature: (key) => Boolean(features[key]),
  isExamLimitReached: false,
  refetch: async () => {},
});

const planError = (data: Record<string, unknown>) =>
  ({ response: { status: 403, data: { statusCode: 403, message: "Not in plan", ...data } } }) as unknown as AxiosError<ApiError>;

/** A screen whose save call the server refuses. */
const RefusedAction = ({ error }: { error: AxiosError<ApiError> }) => {
  const { handleError } = useApiError();
  return (
    <button type="button" onClick={() => handleError(error)}>
      Save
    </button>
  );
};

describe("locked-feature message (FND-07)", () => {
  it("offers owners and admins the upgrade", async () => {
    renderApp(
      <LockedFeatureProvider>
        <RefusedAction error={planError({ code: "FEATURE_NOT_IN_PLAN", feature: "allow_model_tests" })} />
      </LockedFeatureProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("This feature is one upgrade away — unlock it today!")).toBeTruthy();
    expect(screen.getByText("Model tests")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Upgrade" }).getAttribute("href")).toBe("/billing");
  });

  it("tells everyone else to ask their admin, with no upgrade button", async () => {
    billingAccess = { role: "TEACHER", canManageBilling: false };
    renderApp(
      <LockedFeatureProvider>
        <RefusedAction error={planError({ code: "PLAN_LIMIT_REACHED", limit: "max_exams_per_month" })} />
      </LockedFeatureProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Ask your admin to unlock this.")).toBeTruthy();
    expect(screen.getByText("Plan limit reached")).toBeTruthy();
    expect(screen.getByText("Tests per month")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Upgrade" })).toBeNull();
  });

  it("is shown in Bangla", async () => {
    renderApp(
      <LockedFeatureProvider>
        <RefusedAction error={planError({ code: "FEATURE_NOT_IN_PLAN", feature: "allow_passage_questions" })} />
      </LockedFeatureProvider>,
      { locale: "bn" },
    );
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("এই ফিচার মাত্র এক আপগ্রেড দূরে — আজই চালু করুন!")).toBeTruthy();
  });

  it("keeps the toast for other 403s", async () => {
    renderApp(
      <LockedFeatureProvider>
        <RefusedAction error={planError({ message: "You are not a member" })} />
      </LockedFeatureProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("You are not a member")).toBeTruthy();
    expect(screen.queryByText("Not in your plan")).toBeNull();
  });

  it("ends an inline hint by role", () => {
    renderApp(<UpgradeLink />);
    expect(screen.getByRole("link", { name: "Upgrade" })).toBeTruthy();
    cleanup();
    billingAccess = { role: "TEACHER", canManageBilling: false };
    renderApp(<UpgradeLink />);
    expect(screen.getByText("Ask your admin to unlock this.")).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });
});

describe("menu items behind a feature", () => {
  const renderGate = (state: EntitlementsState) =>
    renderApp(
      <EntitlementsContext.Provider value={state}>
        <FeatureNavGate feature="advanced_analytics">
          <a href="/analytics">Analytics</a>
        </FeatureNavGate>
      </EntitlementsContext.Provider>,
    );

  it("are hidden while the plan has the feature off, and while loading", () => {
    renderGate(entitlementsState({ advanced_analytics: false }));
    expect(screen.queryByRole("link", { name: "Analytics" })).toBeNull();
    cleanup();
    renderGate(entitlementsState({ advanced_analytics: true }, true));
    expect(screen.queryByRole("link", { name: "Analytics" })).toBeNull();
  });

  it("are shown when the plan has it", () => {
    renderGate(entitlementsState({ advanced_analytics: true }));
    expect(screen.getByRole("link", { name: "Analytics" })).toBeTruthy();
  });
});

describe("More features (FND-08)", () => {
  const catalog: FeatureCatalog = {
    features: [
      { key: "allow_model_tests", group: "Question", label: "Model tests" },
      { key: "allow_passage_questions", group: "Question", label: "Passage questions" },
    ],
    limits: [],
  };

  it("marks included features and sends a request for a locked one", async () => {
    billingAccess = { role: "TEACHER", canManageBilling: false };
    get.mockResolvedValue({ data: { payload: catalog } });
    post.mockResolvedValue({ data: { payload: { id: "r1" } } });
    renderApp(
      <EntitlementsContext.Provider value={entitlementsState({ allow_model_tests: true })}>
        <MoreFeatures />
      </EntitlementsContext.Provider>,
    );
    expect(await screen.findByText("Included")).toBeTruthy();
    expect(screen.getByText("Several questions on one reading passage.")).toBeTruthy();
    // Only owners and admins are offered the upgrade.
    expect(screen.queryByRole("link", { name: "Upgrade" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Request Passage questions" }));
    fireEvent.change(await screen.findByLabelText("Note (optional)"), { target: { value: "  For reading tests " } });
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post.mock.calls[0][0]).toMatch(/\/me\/feature-requests$/);
    expect(post.mock.calls[0][1]).toEqual({ feature_key: "allow_passage_questions", note: "For reading tests" });
    expect(await screen.findByText("Requested")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Request Passage questions" })).toBeNull();
  });

  it("offers owners the upgrade", async () => {
    get.mockResolvedValue({ data: { payload: catalog } });
    renderApp(
      <EntitlementsContext.Provider value={entitlementsState({})}>
        <MoreFeatures />
      </EntitlementsContext.Provider>,
    );
    expect(await screen.findByText("Your plan: Basic")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Upgrade" }).getAttribute("href")).toBe("/billing");
  });
});
