"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, Skeleton } from "@/design/ui";
import useAcademicsRequest from "@/hooks/academics/useAcademicsRequest";
import useFormat from "@/i18n/useFormat";
import axiosReq from "@/lib/axios";
import SessionFormDrawer from "../SessionFormDrawer";

/** Step 2: the school year the setup goes into (the default session, created on first use). */
const SetupSessionStep = () => {
  const t = useTranslations("academics.setup.session");
  const format = useFormat();
  const { baseUrl, run } = useAcademicsRequest();
  const [sessions, setSessions] = useState<AcademicSession[] | null>(null);
  const [editing, setEditing] = useState<AcademicSession | "new" | null>(null);

  const fetchSessions = useCallback(
    () => run(() => axiosReq.get<ApiResponse<AcademicSession[]>>(`${baseUrl}/sessions`)).then((res) => res?.data?.payload ?? []),
    [baseUrl, run],
  );

  useEffect(() => {
    void fetchSessions().then(setSessions);
  }, [fetchSessions]);

  const open = (sessions ?? []).filter((s) => s.status === "ACTIVE");

  return (
    <Card
      title={t("title")}
      description={t("intro")}
      actions={
        <Button size="sm" variant="secondary" onClick={() => setEditing("new")}>
          {t("add")}
        </Button>
      }
    >
      {sessions === null ? (
        <Skeleton lines={3} />
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {open.map((session) => (
            <li key={session.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="flex items-center gap-2 text-body font-medium text-ink">
                  {session.name}
                  {session.is_default ? <Badge tone="primary">{t("default")}</Badge> : null}
                </p>
                <p className="text-body-sm text-ink-muted">
                  {format.date(session.start_date)} – {format.date(session.end_date)}
                </p>
              </div>
              <Button size="sm" variant="ghost" aria-label={t("editFor", { name: session.name })} onClick={() => setEditing(session)}>
                {t("edit")}
              </Button>
            </li>
          ))}
        </ul>
      )}

      {editing !== null ? (
        <SessionFormDrawer
          key={editing === "new" ? "new" : editing.id}
          session={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void fetchSessions().then(setSessions);
          }}
        />
      ) : null}
    </Card>
  );
};

export default SetupSessionStep;
