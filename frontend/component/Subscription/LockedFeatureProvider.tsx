"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { Button, buttonClasses, Modal } from "@/design/ui";
import useBillingAccess from "@/hooks/organization/useBillingAccess";
import useFeatureNames from "./useFeatureNames";

export type LockedFeatureInfo = { code: PlanErrorCode; feature?: string; limit?: string };

type LockedFeatureContextValue = { show: (info: LockedFeatureInfo) => void };

const LockedFeatureContext = createContext<LockedFeatureContextValue | null>(null);

/** null outside the signed-in layout; callers then fall back to a toast. */
export const useLockedFeature = () => useContext(LockedFeatureContext);

export const PLAN_ERROR_CODES: readonly PlanErrorCode[] = ["FEATURE_NOT_IN_PLAN", "PLAN_LIMIT_REACHED"];

export const isPlanErrorCode = (code: unknown): code is PlanErrorCode => PLAN_ERROR_CODES.includes(code as PlanErrorCode);

/**
 * The message for a feature or limit the plan does not include (FND-07). The server answers
 * 403 FEATURE_NOT_IN_PLAN / PLAN_LIMIT_REACHED and the text depends on who asks: owners and
 * admins are offered the upgrade, everyone else is told to ask their admin.
 */
export const LockedFeatureDialog = ({ info, onClose }: { info: LockedFeatureInfo | null; onClose: () => void }) => {
  const t = useTranslations("features.locked");
  const { canManageBilling } = useBillingAccess();
  const { featureName, limitName } = useFeatureNames();

  const subject = info?.feature ? featureName(info.feature) : info?.limit ? limitName(info.limit) : null;

  return (
    <Modal
      open={Boolean(info)}
      onClose={onClose}
      size="sm"
      title={info?.code === "PLAN_LIMIT_REACHED" ? t("limitTitle") : t("title")}
      description={subject ?? undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("close")}
          </Button>
          {canManageBilling ? (
            <Link href="/billing" className={buttonClasses()} onClick={onClose}>
              {t("upgrade")}
            </Link>
          ) : null}
        </>
      }
    >
      <p className="text-body text-ink">{canManageBilling ? t("ownerMessage") : t("memberMessage")}</p>
      <p className="mt-3 text-body-sm text-ink-muted">
        <Link href="/features" className="text-primary underline" onClick={onClose}>
          {t("moreFeatures")}
        </Link>
      </p>
    </Modal>
  );
};

export const LockedFeatureProvider = ({ children }: { children: React.ReactNode }) => {
  const [info, setInfo] = useState<LockedFeatureInfo | null>(null);
  const show = useCallback((next: LockedFeatureInfo) => setInfo(next), []);
  const value = useMemo(() => ({ show }), [show]);

  return (
    <LockedFeatureContext.Provider value={value}>
      {children}
      <LockedFeatureDialog info={info} onClose={() => setInfo(null)} />
    </LockedFeatureContext.Provider>
  );
};

export default LockedFeatureProvider;
