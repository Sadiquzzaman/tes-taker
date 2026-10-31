import { useTranslations } from "next-intl";
import { useCallback } from "react";
import useFeatureNames from "@/component/Subscription/useFeatureNames";
import useFormat from "@/i18n/useFormat";

/** The areas an action belongs to (the part before the dot), in filter order. */
export const AUDIT_AREAS = [
  "member",
  "subscription",
  "plan",
  "payment",
  "feature_request",
  "exam",
  "grade",
  "grading_scale",
  "organization",
  "teacher_request",
  "user",
  "teacher",
  "message_template",
  "sms_credits",
  "guardian",
] as const;

export interface AuditChange {
  key: string;
  before: AuditValue | undefined;
  after: AuditValue | undefined;
}

const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const MAX_VALUE_LENGTH = 80;

/** The fields whose value differs between before and after (all of them for a create or delete). */
export const auditChangeList = (log: Pick<AuditLogItem, "before" | "after">): AuditChange[] => {
  const before = log.before ?? {};
  const after = log.after ?? {};
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  return keys
    .filter((key) => JSON.stringify(before[key] ?? null) !== JSON.stringify(after[key] ?? null))
    .map((key) => ({ key, before: before[key], after: after[key] }));
};

/**
 * Translated text for audit rows (messages `audit.*`): action and field names, and values.
 * An action or field the messages do not know yet shows its key, so new actions from other
 * features still read sensibly before their names are added.
 */
const useAuditText = () => {
  const t = useTranslations("audit");
  const format = useFormat();
  const { featureName, limitName } = useFeatureNames();

  const lookup = useCallback(
    (path: string, fallback: string) => {
      const key = path as Parameters<typeof t>[0];
      return t.has(key) ? t(key) : fallback;
    },
    [t],
  );

  const actionName = useCallback((action: string) => lookup(`actions.${action}`, action), [lookup]);
  const areaName = useCallback((area: string) => lookup(`areas.${area}`, area), [lookup]);
  const fieldName = useCallback((field: string) => lookup(`fields.${field}`, field.replace(/_/g, " ")), [lookup]);

  const formatValue = useCallback(
    (field: string, value: AuditValue | undefined): string => {
      if (value === null || value === undefined || value === "") return "—";
      if (typeof value === "boolean") return value ? t("yes") : t("no");
      if (typeof value === "number") return format.number(value);
      if (typeof value === "string") {
        if (field === "key") return featureName(value, limitName(value));
        if (ISO_TIME.test(value)) return format.dateTime(value);
        return value;
      }
      const json = JSON.stringify(value);
      return json.length > MAX_VALUE_LENGTH ? `${json.slice(0, MAX_VALUE_LENGTH - 1)}…` : json;
    },
    [featureName, format, limitName, t],
  );

  /** A change's value: "old → new", or only the value when the field was added or removed. */
  const changeText = useCallback(
    ({ key, before, after }: AuditChange): string => {
      if (before === undefined || before === null) return formatValue(key, after);
      if (after === undefined) return formatValue(key, before);
      return t("beforeAfter", { before: formatValue(key, before), after: formatValue(key, after) });
    },
    [formatValue, t],
  );

  /** One line for the table: the first changes as "field: old → new". */
  const summary = useCallback(
    (log: AuditLogItem, max = 2): string => {
      const changes = auditChangeList(log);
      const parts = changes.slice(0, max).map((change) => `${fieldName(change.key)}: ${changeText(change)}`);
      if (changes.length > max) parts.push(t("more", { count: changes.length - max }));
      return parts.join(" · ");
    },
    [changeText, fieldName, t],
  );

  const actorName = useCallback((log: AuditLogItem) => log.actor?.full_name || (log.actor ? t("unknownUser") : t("system")), [t]);

  return { actionName, areaName, fieldName, formatValue, changeText, summary, actorName };
};

export default useAuditText;
