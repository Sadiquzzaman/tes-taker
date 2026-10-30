"use client";

import { useTranslations } from "next-intl";
import { Button, Drawer } from "@/design/ui";
import useFormat from "@/i18n/useFormat";
import useAuditText, { auditChangeList } from "./useAuditText";

interface AuditLogDetailsProps {
  log: AuditLogItem | null;
  onClose: () => void;
  /** Platform admin only: show every change for this row's organisation. */
  onFilterOrganization?: (organization: { id: string; name: string }) => void;
}

/** One audit row in full: who, when, what changed (before → after), the reason and, for platform admins, the IP. */
const AuditLogDetails = ({ log, onClose, onFilterOrganization }: AuditLogDetailsProps) => {
  const t = useTranslations("audit");
  const format = useFormat();
  const { actionName, fieldName, changeText, actorName } = useAuditText();
  const changes = log ? auditChangeList(log) : [];

  const rows: Array<[string, string]> = log
    ? [
        [t("when"), format.dateTime(log.created_at)],
        [t("who"), actorName(log)],
        ...(log.organization ? ([[t("organization"), log.organization.name]] as Array<[string, string]>) : []),
        ...(log.entity_type ? ([[t("record"), fieldName(log.entity_type)]] as Array<[string, string]>) : []),
        ...(log.reason ? ([[t("reason"), log.reason]] as Array<[string, string]>) : []),
        ...(log.ip !== undefined ? ([[t("ip"), log.ip || "—"]] as Array<[string, string]>) : []),
      ]
    : [];

  return (
    <Drawer open={Boolean(log)} onClose={onClose} title={log ? actionName(log.action) : ""}>
      {log ? (
        <div className="flex flex-col gap-6">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-body-sm">
            {rows.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-ink-muted">{label}</dt>
                <dd className="break-words text-ink">{value}</dd>
              </div>
            ))}
          </dl>

          <section className="flex flex-col gap-2" aria-labelledby="audit-changes-heading">
            <h3 id="audit-changes-heading" className="text-title-sm font-semibold text-ink">
              {t("changes")}
            </h3>
            {changes.length === 0 ? (
              <p className="text-body-sm text-ink-muted">{t("noChanges")}</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {changes.map((change) => (
                  <li key={change.key} className="flex flex-col gap-1 py-2">
                    <span className="text-body-sm font-medium text-ink">{fieldName(change.key)}</span>
                    <span className="break-words text-body-sm text-ink-muted">{changeText(change)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {onFilterOrganization && log.organization ? (
            <Button
              variant="secondary"
              onClick={() => {
                onFilterOrganization(log.organization as { id: string; name: string });
                onClose();
              }}
            >
              {t("onlyThisOrganization")}
            </Button>
          ) : null}
        </div>
      ) : null}
    </Drawer>
  );
};

export default AuditLogDetails;
