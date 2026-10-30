"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Skeleton } from "@/design/ui";
import useFormat from "@/i18n/useFormat";
import axiosReq from "@/lib/axios";
import useAuditText from "./useAuditText";

interface AuditRecentChangesProps {
  organizationId: string;
  /** An area such as `subscription.` (plan, switches and limits). */
  action: string;
  /** Change it to load again (after a save). */
  reloadKey?: number;
  limit?: number;
}

/** The latest audit rows for one organisation, as a short list (platform admins). */
const AuditRecentChanges = ({ organizationId, action, reloadKey = 0, limit = 10 }: AuditRecentChangesProps) => {
  const t = useTranslations("audit");
  const format = useFormat();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const { actionName, summary, actorName } = useAuditText();
  const [logs, setLogs] = useState<AuditLogItem[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    axiosReq
      .get<AuditLogListResponse>(`${baseUrl}/audit-logs/admin`, { params: { organization_id: organizationId, action, limit } })
      .then((res) => {
        if (!active) return;
        setLogs(res.data?.payload ?? []);
        setFailed(false);
      })
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [action, baseUrl, limit, organizationId, reloadKey]);

  if (failed) return <p className="text-body-sm text-ink-muted">{t("loadFailed")}</p>;
  if (!logs) return <Skeleton lines={3} />;
  if (logs.length === 0) return <p className="text-body-sm text-ink-muted">{t("noRecentChanges")}</p>;

  return (
    <ul className="flex flex-col divide-y divide-border">
      {logs.map((log) => (
        <li key={log.id} className="flex flex-col gap-0.5 py-2">
          <span className="text-body-sm font-medium text-ink">{actionName(log.action)}</span>
          {summary(log) ? <span className="break-words text-body-sm text-ink">{summary(log)}</span> : null}
          <span className="text-caption text-ink-muted">
            {t("byOn", { who: actorName(log), when: format.dateTime(log.created_at) })}
            {log.reason ? ` · ${log.reason}` : ""}
          </span>
        </li>
      ))}
    </ul>
  );
};

export default AuditRecentChanges;
