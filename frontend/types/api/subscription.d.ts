type SubscriptionPlan = {
  id: string;
  name?: string;
  display_name?: string;
  slug?: string;
  description?: string;
  price_monthly: number;
  price_half_yearly: number;
  price_yearly: number;
  features?: Record<string, boolean>;
  limits?: Record<string, number>;
  is_plan_active: boolean;
  sort_order: number;
  visibility?: string;
};

type BillingCycle = "MONTHLY" | "HALF_YEARLY" | "YEARLY";

type EntitlementsPayload = {
  plan: {
    id: string;
    name: string;
    slug: string;
  };
  features: Record<string, boolean>;
  limits: Record<string, number>;
  usage: {
    exams_used_this_month: number;
    total_exams_used: number;
  };
  subscription?: {
    id: string;
    status: string;
    billing_cycle?: BillingCycle;
    start_date: string;
    end_date?: string;
  } | null;
};
