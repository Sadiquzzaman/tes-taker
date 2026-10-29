import { useTranslations } from "next-intl";
import { useCallback } from "react";
import type en from "@/messages/en.json";

type Features = (typeof en)["features"];
type CatalogKey = keyof Features["catalog"];
type LimitKey = keyof Features["limits"];
type GroupKey = keyof Features["groups"];

/**
 * Translated names and descriptions of plan features and limits, by key (messages `features.*`).
 * A key the messages do not know yet falls back to the API's English label, or the key itself.
 */
const useFeatureNames = () => {
  const t = useTranslations("features");

  const featureName = useCallback(
    (key: string, fallback?: string) =>
      t.has(`catalog.${key as CatalogKey}.name`) ? t(`catalog.${key as CatalogKey}.name`) : fallback || key,
    [t],
  );
  const featureDescription = useCallback(
    (key: string, fallback?: string) =>
      t.has(`catalog.${key as CatalogKey}.description`) ? t(`catalog.${key as CatalogKey}.description`) : fallback || "",
    [t],
  );
  const limitName = useCallback(
    (key: string, fallback?: string) => (t.has(`limits.${key as LimitKey}`) ? t(`limits.${key as LimitKey}`) : fallback || key),
    [t],
  );
  const groupName = useCallback(
    (group: string) => (t.has(`groups.${group as GroupKey}`) ? t(`groups.${group as GroupKey}`) : group),
    [t],
  );

  return { featureName, featureDescription, limitName, groupName };
};

export default useFeatureNames;
