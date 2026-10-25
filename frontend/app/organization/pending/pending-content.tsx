"use client";

import { useTranslations } from "next-intl";
import OrganizationWorkspaceGate from "@/component/Organization/OrganizationWorkspaceGate";
import { AlertIcon, Card } from "@/design/ui";
import useWorkspace from "@/hooks/organization/useWorkspace";

/** What a newly registered organisation sees until a super admin approves it. */
export default function OrganizationPendingContent() {
  const t = useTranslations("organization.pending");
  const { activeOrganization } = useWorkspace();

  return (
    <OrganizationWorkspaceGate allowPending>
      <Card className="mx-auto max-w-xl">
        <div className="flex flex-col items-start gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-warning-soft text-warning">
            <AlertIcon className="size-5" />
          </span>
          <h1 className="text-title font-semibold text-ink">{t("title")}</h1>
          <p className="text-body text-ink-muted">
            {activeOrganization?.name ? t("detailNamed", { name: activeOrganization.name }) : t("detail")}
          </p>
          {activeOrganization?.public_id ? (
            <p className="text-body-sm text-ink">
              {t("id")}: <span className="font-medium">{activeOrganization.public_id}</span>
            </p>
          ) : null}
        </div>
      </Card>
    </OrganizationWorkspaceGate>
  );
}
