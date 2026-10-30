"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, ConfirmDialog, EmptyState, PageHeader, Skeleton, StatusPill, Table, type TableColumn } from "@/design/ui";
import useAcademicsRequest from "@/hooks/academics/useAcademicsRequest";
import useFormat from "@/i18n/useFormat";
import axiosReq from "@/lib/axios";
import SessionFormDrawer from "./SessionFormDrawer";
import TermsDrawer from "./TermsDrawer";

/**
 * Sessions of the workspace (FND-01): school years or coaching terms. Several can be active; one is
 * the default. Owners and admins add, edit and close them; only the owner reopens a closed one.
 */
const SessionsPage = () => {
  const t = useTranslations("academics.sessions");
  const format = useFormat();
  const { baseUrl, run, canManageSessions, canReopenSessions } = useAcademicsRequest();
  const [sessions, setSessions] = useState<AcademicSession[] | null>(null);
  const [editing, setEditing] = useState<AcademicSession | "new" | null>(null);
  const [closing, setClosing] = useState<AcademicSession | null>(null);
  const [termsOf, setTermsOf] = useState<AcademicSession | null>(null);

  const fetchSessions = useCallback(
    () => run(() => axiosReq.get<ApiResponse<AcademicSession[]>>(`${baseUrl}/sessions`)).then((res) => res?.data?.payload ?? []),
    [baseUrl, run],
  );
  const load = useCallback(() => void fetchSessions().then(setSessions), [fetchSessions]);

  useEffect(() => {
    if (canManageSessions) void fetchSessions().then(setSessions);
  }, [canManageSessions, fetchSessions]);

  const act = async (request: () => Promise<unknown>, success: string) => {
    if (await run(request, success)) load();
  };

  if (!canManageSessions) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader title={t("title")} />
        <Card>
          <EmptyState title={t("noAccess")} />
        </Card>
      </div>
    );
  }

  const columns: TableColumn<AcademicSession>[] = [
    {
      key: "name",
      header: t("name"),
      sortValue: (row) => row.name,
      cell: (row) => (
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-ink">{row.name}</span>
          {row.is_default ? <Badge tone="primary">{t("default")}</Badge> : null}
        </span>
      ),
    },
    {
      key: "dates",
      header: t("dates"),
      sortValue: (row) => row.start_date,
      cell: (row) => `${format.date(row.start_date)} – ${format.date(row.end_date)}`,
    },
    {
      key: "status",
      header: t("status"),
      sortValue: (row) => row.status,
      cell: (row) =>
        row.status === "ACTIVE" ? (
          <StatusPill tone="success">{t("statusActive")}</StatusPill>
        ) : (
          <StatusPill tone="neutral">{t("statusClosed")}</StatusPill>
        ),
    },
    {
      key: "actions",
      header: t("actions"),
      align: "right",
      cell: (row) => (
        <div className="flex flex-wrap justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={() => setTermsOf(row)}>
            {t("termsFor", { name: row.name })}
          </Button>
          {row.status === "ACTIVE" ? (
            <>
              <Button size="sm" variant="ghost" onClick={() => setEditing(row)}>
                {t("editFor", { name: row.name })}
              </Button>
              {row.is_default ? null : (
                <>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void act(() => axiosReq.post(`${baseUrl}/sessions/${row.id}/default`), t("defaultChanged"))}
                  >
                    {t("makeDefaultFor", { name: row.name })}
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => setClosing(row)}>
                    {t("closeFor", { name: row.name })}
                  </Button>
                </>
              )}
            </>
          ) : canReopenSessions ? (
            <Button size="sm" variant="secondary" onClick={() => void act(() => axiosReq.post(`${baseUrl}/sessions/${row.id}/reopen`), t("reopened"))}>
              {t("reopenFor", { name: row.name })}
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader title={t("title")} description={t("intro")} actions={<Button onClick={() => setEditing("new")}>{t("add")}</Button>} />
      <Card>
        {sessions === null ? (
          <Skeleton lines={4} />
        ) : sessions.length === 0 ? (
          <EmptyState title={t("empty")} />
        ) : (
          <Table caption={t("title")} columns={columns} rows={sessions} getRowId={(row) => row.id} />
        )}
      </Card>

      {editing !== null ? (
        <SessionFormDrawer
          key={editing === "new" ? "new" : editing.id}
          session={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      ) : null}
      {termsOf ? <TermsDrawer key={termsOf.id} session={termsOf} canManage={canManageSessions} onClose={() => setTermsOf(null)} /> : null}
      <ConfirmDialog
        open={Boolean(closing)}
        tone="danger"
        title={closing ? t("closeTitle", { name: closing.name }) : ""}
        description={t("closeDetail")}
        confirmLabel={t("closeConfirm")}
        onCancel={() => setClosing(null)}
        onConfirm={() => {
          const session = closing;
          setClosing(null);
          if (session) void act(() => axiosReq.post(`${baseUrl}/sessions/${session.id}/close`), t("closed"));
        }}
      />
    </div>
  );
};

export default SessionsPage;
