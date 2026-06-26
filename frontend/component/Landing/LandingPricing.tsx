"use client";

import { useRouter } from "next/navigation";
import useGetPlans from "@/hooks/api/subscription/useGetPlans";

const formatPrice = (value: number) => {
  if (!value) return "Free";
  return `৳${Number(value).toLocaleString()}`;
};

const getPlanName = (plan: SubscriptionPlan) => plan.name ?? plan.display_name ?? "Plan";

const LandingPricing = () => {
  const { plans, loading } = useGetPlans();
  const router = useRouter();
  const sortedPlans = [...plans].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const handleSelect = (plan: SubscriptionPlan) => {
    const isPaid = Number(plan.price_monthly) > 0;
    // Remember the chosen paid plan so we can prompt for payment right after signup/login.
    if (isPaid && plan.slug) {
      localStorage.setItem("pendingPlan", plan.slug);
    } else {
      localStorage.removeItem("pendingPlan");
    }
    router.push("/signup");
  };

  return (
    <section id="pricing" className="py-20 px-6 bg-[#EFF0F3]">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2
            className="text-3xl md:text-4xl text-[#232A25] mb-3"
            style={{ fontFamily: "DM Serif Display, serif" }}
          >
            Simple, transparent pricing
          </h2>
          <p className="text-[#747775] max-w-2xl mx-auto" style={{ fontFamily: "Instrument Sans, sans-serif" }}>
            Start free and scale as your teaching grows. Every plan includes secure online exams and class management.
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="h-72 rounded-[12px] bg-white/60 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {sortedPlans.map((plan) => (
              <div
                key={plan.id}
                className="bg-white rounded-[12px] p-6 border border-[#EFF0F3] flex flex-col shadow-sm hover:shadow-md transition-shadow"
              >
                <h3 className="text-lg font-semibold text-[#232A25] mb-1" style={{ fontFamily: "Public Sans, sans-serif" }}>
                  {getPlanName(plan)}
                </h3>
                {plan.description && (
                  <p className="text-sm text-[#747775] mb-4 min-h-[40px]">{plan.description}</p>
                )}
                <div className="mb-4">
                  <span className="text-3xl font-bold text-[#49734F]" style={{ fontFamily: "Public Sans, sans-serif" }}>
                    {formatPrice(plan.price_monthly)}
                  </span>
                  {plan.price_monthly > 0 && (
                    <span className="text-sm text-[#747775] ml-1">/month</span>
                  )}
                </div>
                <ul className="text-sm text-[#747775] space-y-2 mb-6 flex-1">
                  {plan.limits?.max_exams_per_month ? (
                    <li>{plan.limits.max_exams_per_month} exams per month</li>
                  ) : plan.limits?.max_total_exams ? (
                    <li>{plan.limits.max_total_exams} exams total</li>
                  ) : (
                    <li>Unlimited exams</li>
                  )}
                  {plan.limits?.max_students_per_exam && (
                    <li>Up to {plan.limits.max_students_per_exam} students per exam</li>
                  )}
                </ul>
                <button
                  type="button"
                  onClick={() => handleSelect(plan)}
                  className="w-full text-center py-2.5 rounded-[8px] bg-[#49734F] text-white text-sm font-medium hover:bg-[#3d6242] transition-colors"
                  style={{ fontFamily: "Instrument Sans, sans-serif" }}
                >
                  {Number(plan.price_monthly) > 0 ? "Select plan" : "Get started"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default LandingPricing;
