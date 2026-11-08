"use client";

import useEntitlements from "@/hooks/api/subscription/useEntitlements";

/**
 * Hides a menu item while the current workspace's plan has its feature off (FND-07), and while
 * that is still loading (unless this browser remembers the last answer) so a locked item does not flash. If entitlements fail to load the item is
 * shown: the server still refuses a locked feature with the locked-feature message.
 */
const FeatureNavGate = ({ feature, children }: { feature: string | string[]; children: React.ReactNode }) => {
  const { entitlements, loading } = useEntitlements();
  const keys = Array.isArray(feature) ? feature : [feature];
  if (entitlements ? !keys.some((key) => entitlements.features?.[key]) : loading) return null;
  return <>{children}</>;
};

export default FeatureNavGate;
