"use client";

import useEntitlements from "@/hooks/api/subscription/useEntitlements";

/**
 * Hides a menu item while the current workspace's plan has its feature off (FND-07), and while
 * that is still loading so a locked item does not flash. If entitlements fail to load the item is
 * shown: the server still refuses a locked feature with the locked-feature message.
 */
const FeatureNavGate = ({ feature, children }: { feature: string; children: React.ReactNode }) => {
  const { entitlements, loading } = useEntitlements();
  if (loading || (entitlements && !entitlements.features?.[feature])) return null;
  return <>{children}</>;
};

export default FeatureNavGate;
