"use client";

import { AxiosError } from "axios";
import NextLink from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { buttonClasses, Card, EmptyState, Link, PageHeader, Skeleton, Table, type TableColumn } from "@/design/ui";
import { useApiError } from "@/hooks/api/useApiError";
import useWorkspace from "@/hooks/organization/useWorkspace";
import useFormat from "@/i18n/useFormat";
import axiosReq from "@/lib/axios";
import OrganizationWorkspaceGate from "./OrganizationWorkspaceGate";

const canManageClasses = (role?: OrganizationMemberRole) => role === "OWNER" || role === "ADMIN" || role === "ASSISTANT";

export const subjectLabel = (item: Class) =>
  (item.classSubjects ?? [])
    .map((row) => {
      const name = row.subject?.name;
      if (!name) return "";
      return row.subject?.code ? `${name} (${row.subject.code})` : name;
    })
    .filter(Boolean)
    .join(", ") || "—";

/** Every class in the organisation, with its subjects and student count. */
const OrganizationClassesContent = () => {
  const t = useTranslations("organization.classes");
  const format = useFormat();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const { organizationId, activeOrganization } = useWorkspace();
  const { handleError } = useApiError();
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!organizationId) {
      setClasses([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await axiosReq.get<ApiResponse<Class[]>>(`${baseUrl}/classes`);
      setClasses(res.data?.payload ?? []);
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
      setClasses([]);
    } finally {
      setLoading(false);
    }
  }, [baseUrl, handleError, organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns: TableColumn<Class>[] = [
    { key: "name", header: t("class"), cell: (row) => row.class_name || "—", sortValue: (row) => row.class_name },
    { key: "subjects", header: t("subjects"), cell: (row) => subjectLabel(row) },
    {
      key: "students",
      header: t("students"),
      cell: (row) => format.number(row.classStudents?.length ?? 0),
      sortValue: (row) => row.classStudents?.length ?? 0,
      align: "right",
    },
    {
      key: "view",
      header: t("view"),
      align: "right",
      cell: (row) => (
        <Link href={`/classes/details/${row.id}`} variant="plain" className="font-medium">
          {t("view")}
        </Link>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader
        title={t("title")}
        description={activeOrganization?.name}
        actions={
          canManageClasses(activeOrganization?.role) ? (
            <NextLink href="/classes/create" className={buttonClasses()}>
              {t("create")}
            </NextLink>
          ) : undefined
        }
      />
      <Card flush>
        {loading ? (
          <div className="p-4" aria-busy="true">
            <Skeleton lines={5} />
          </div>
        ) : (
          <Table caption={t("title")} columns={columns} rows={classes} getRowId={(row) => row.id} empty={<EmptyState title={t("empty")} />} />
        )}
      </Card>
    </div>
  );
};

const OrganizationClasses = () => (
  <OrganizationWorkspaceGate>
    <OrganizationClassesContent />
  </OrganizationWorkspaceGate>
);

export default OrganizationClasses;
