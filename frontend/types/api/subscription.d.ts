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

/** GET /me/entitlements: what the current workspace may use (design §8.3). */
type EntitlementsPayload = {
  organization_id?: string;
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
  /** The platform admin's switches in force now. */
  overrides?: FeatureOverrideValue[];
};

type FeatureOverrideValue = { key: string; value: boolean | number; expires_at: string | null };

/** A platform admin's stored override (Admin → Organisations). */
type FeatureOverrideItem = FeatureOverrideValue & { id: string; reason?: string | null };

/** GET /subscriptions/feature-catalog: the feature and limit keys plans and overrides use. */
type CatalogFeature = { key: string; group: string; label: string; description?: string };
type CatalogLimit = { key: string; label: string; description?: string; min?: number };
type FeatureCatalog = { features: CatalogFeature[]; limits: CatalogLimit[] };

/** The 403 codes the client turns into the locked-feature message (FND-07). */
type PlanErrorCode = "FEATURE_NOT_IN_PLAN" | "PLAN_LIMIT_REACHED";

/** GET /subscriptions/admin/organizations/:id/entitlements */
type AdminOrganizationEntitlements = {
  organization: { id: string; name: string; kind: string; status: string };
  entitlements: EntitlementsPayload;
  overrides: FeatureOverrideItem[];
};

type FeatureRequestStatus = "OPEN" | "HANDLED";

/** "Request this feature" (FND-08), as listed for platform admins. */
type FeatureRequestItem = {
  id: string;
  organization_id: string;
  feature_key: string;
  note: string | null;
  status: FeatureRequestStatus;
  created_at: string;
  handled_at: string | null;
  organization?: { id: string; name: string; kind?: string } | null;
  user?: { id: string; full_name?: string | null; email?: string | null; phone?: string | null } | null;
};
