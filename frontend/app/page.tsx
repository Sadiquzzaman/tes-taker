import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import LandingHeader from "@/component/Landing/LandingHeader";
import LandingPricing from "@/component/Landing/LandingPricing";
import {
  LandingCallToAction,
  LandingFeatures,
  LandingFooter,
  LandingForSchools,
  LandingHero,
  LandingProctoring,
} from "@/component/Landing/LandingSections";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("landing.meta");
  return { title: t("title"), description: t("description") };
}

/** The public home page: what Instructor does, the proctoring it really runs, plans, and sign-up. */
export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-surface">
      <LandingHeader />
      <main>
        <LandingHero />
        <LandingFeatures />
        <LandingProctoring />
        <LandingForSchools />
        <LandingPricing />
        <LandingCallToAction />
      </main>
      <LandingFooter />
    </div>
  );
}
