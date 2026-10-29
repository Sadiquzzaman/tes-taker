"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import useBillingAccess from "@/hooks/organization/useBillingAccess";

/**
 * The end of a "not in your plan" hint (FND-07): owners and admins get the upgrade link, everyone
 * else is told to ask their admin.
 */
const UpgradeLink = () => {
  const t = useTranslations("features.locked");
  const { canManageBilling } = useBillingAccess();
  if (!canManageBilling) return <span>{t("memberMessage")}</span>;
  return (
    <Link href="/billing" className="text-primary underline">
      {t("upgrade")}
    </Link>
  );
};

export default UpgradeLink;
