"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { Badge, Card, PageHeader, Skeleton, StatTile, StatusPill } from "@/design/ui";
import { useApiError } from "@/hooks/api/useApiError";
import useWorkspace from "@/hooks/organization/useWorkspace";
import axiosReq from "@/lib/axios";
import LevelLabelsCard from "./LevelLabelsCard";
import OrganizationSettingsCard from "./OrganizationSettingsCard";
import OrganizationWorkspaceGate from "./OrganizationWorkspaceGate";
import SetupBanner from "./SetupBanner";

const STATUS_TONE = { pending: "warning", approved: "success", rejected: "danger", inactive: "neutral" } as const;

/** Headline counts for the organisation, its number, status and the viewer's role. */
const OrganizationOverviewContent = () => {
  const t = useTranslations("organization");
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const { organizationId, activeOrganization } = useWorkspace();
  const { handleError } = useApiError();
  const [detail, setDetail] = useState<OrganizationDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!organizationId) {
      setDetail(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await axiosReq.get<ApiResponse<OrganizationDetail>>(`${baseUrl}/organizations/${organizationId}`);
      setDetail(res.data?.payload ?? null);
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [baseUrl, handleError, organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const status = detail?.status || activeOrganization?.status || "approved";
  const tiles = [
    { key: "teachers", value: detail?.teachers_count },
    { key: "students", value: detail?.students_count },
    { key: "classes", value: detail?.classes_count },
    { key: "exams", value: detail?.exams_count },
  ] as const;

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader title={t("overview.title")} description={activeOrganization?.name} />
      {organizationId ? <SetupBanner /> : null}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((tile) =>
          loading ? (
            <Skeleton key={tile.key} className="h-24 rounded-card" />
          ) : (
            <StatTile key={tile.key} label={t(`overview.${tile.key}`)} value={tile.value ?? "—"} />
          ),
        )}
      </div>
      <Card title={t("overview.details")}>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <dt className="text-body-sm text-ink-muted">{t("overview.number")}</dt>
            <dd className="text-title-sm font-semibold text-primary">{detail?.organization_number ?? activeOrganization?.organization_number ?? "—"}</dd>
          </div>
          <div className="flex flex-col items-start gap-1">
            <dt className="text-body-sm text-ink-muted">{t("overview.status")}</dt>
            <dd>
              <StatusPill tone={STATUS_TONE[status]}>{t(`statuses.${status}`)}</StatusPill>
            </dd>
          </div>
          <div className="flex flex-col items-start gap-1">
            <dt className="text-body-sm text-ink-muted">{t("overview.yourRole")}</dt>
            <dd>{activeOrganization?.role ? <Badge tone="primary">{t(`roles.${activeOrganization.role}`)}</Badge> : "—"}</dd>
          </div>
        </dl>
      </Card>
      {organizationId ? <OrganizationSettingsCard organizationId={organizationId} /> : null}
      {organizationId && activeOrganization?.role === "OWNER" ? <LevelLabelsCard /> : null}
    </div>
  );
};

const OrganizationOverview = () => (
  <OrganizationWorkspaceGate allowedRoles={["OWNER", "ADMIN"]}>
    <OrganizationOverviewContent />
  </OrganizationWorkspaceGate>
);

export default OrganizationOverview;
