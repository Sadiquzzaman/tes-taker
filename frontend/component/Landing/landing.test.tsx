import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import bn from "@/messages/bn.json";
import { renderApp } from "@/i18n/test-utils";
import LandingHeader from "./LandingHeader";
import LandingPricing from "./LandingPricing";
import { LandingFooter, LandingHero, LandingProctoring } from "./LandingSections";

const get = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/" }));
vi.mock("@/lib/axios", () => ({ default: { get: (...args: unknown[]) => get(...args), patch: vi.fn() } }));

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

const plan = (slug: string, sort_order: number, price_monthly: number, limits: Record<string, number>) =>
  ({ id: slug, slug, name: slug === "free" ? "Free" : "Pro", sort_order, price_monthly, price_half_yearly: 0, price_yearly: 0, limits, is_plan_active: true }) as SubscriptionPlan;

describe("landing header", () => {
  it("opens the phone menu and closes it when a section is chosen", async () => {
    renderApp(<LandingHeader />);
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    const menu = await screen.findByRole("dialog", { name: "Menu" });
    const pricing = within(menu).getByRole("link", { name: "Pricing" });
    expect(pricing.getAttribute("href")).toBe("#pricing");
    expect(within(menu).getByRole("link", { name: "Sign up free" }).getAttribute("href")).toBe("/signup");
    fireEvent.click(pricing);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});

describe("landing sections", () => {
  it("shows the hero and the product preview as one labelled image, in Bangla", () => {
    renderApp(<LandingHero />, { locale: "bn" });
    expect(screen.getByRole("heading", { level: 1, name: "নিরাপদ অনলাইন পরীক্ষা, যা শিক্ষার্থীরা ফোনেই দিতে পারে" })).toBeTruthy();
    expect(screen.getByRole("img", { name: /Instructor-এর ঝলক/ })).toBeTruthy();
    // The sample numbers inside the preview use Bangla digits.
    expect(screen.getByText("২৮ / ৩২")).toBeTruthy();
  });

  it("lists only the proctoring checks the exam screen runs", () => {
    renderApp(<LandingProctoring />);
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
    expect(screen.getByText("Copying and pasting")).toBeTruthy();
  });

  it("writes the footer year in Bangla digits", () => {
    renderApp(<LandingFooter />, { locale: "bn" });
    const year = new Intl.NumberFormat("bn-BD", { useGrouping: false }).format(new Date().getFullYear());
    expect(screen.getByText(new RegExp(year))).toBeTruthy();
  });

  it("does not promise features that are not built", () => {
    // Review §13: the old page sold risk scoring, push notifications and real-time alerts.
    const landing = JSON.stringify([en.landing, bn.landing]).toLowerCase();
    for (const claim of ["risk", "push notification", "real-time", "real time", "ঝুঁকি", "পুশ"]) {
      expect(landing).not.toContain(claim);
    }
  });
});

describe("landing pricing", () => {
  it("shows live plans with Bangla digits and the free plan as free", async () => {
    get.mockResolvedValue({
      data: { payload: [plan("pro", 2, 700, { max_exams_per_month: 30, max_students_per_exam: 200 }), plan("free", 1, 0, { max_total_exams: 2 })] },
    });
    renderApp(<LandingPricing />, { locale: "bn" });
    const cards = await screen.findAllByRole("heading", { level: 3 });
    expect(cards.map((card) => card.textContent)).toEqual(["Free", "Pro"]);
    expect(screen.getByText("৳৭০০")).toBeTruthy();
    expect(screen.getByText("মোট ২টি পরীক্ষা")).toBeTruthy();
    expect(screen.getByText("ফ্রি")).toBeTruthy();
  });

  it("still offers sign-up when plans fail to load", async () => {
    get.mockRejectedValue(new Error("offline"));
    renderApp(<LandingPricing />);
    expect(await screen.findByText("Plans did not load. You can still sign up for free.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Get started" }).getAttribute("href")).toBe("/signup");
  });
});
