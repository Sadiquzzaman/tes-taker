"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { RichTextContent } from "@/component/RichTextEditor";
import { useToast } from "@/component/Toast/ToastContext";
import { Button, Card, ConfirmDialog, DatePicker, ErrorState, Link, Modal, PageHeader, Skeleton, StatusPill, TimePicker } from "@/design/ui";
import { useApiError } from "@/hooks/api/useApiError";
import useFormat from "@/i18n/useFormat";
import { fromZonedParts } from "@/i18n/zonedTime";
import axiosReq from "@/lib/axios";
import HomeworkEditor, { HOMEWORK_FORM_ERRORS } from "./HomeworkEditor";
import { classesLabel, DUE_TONE, dueState, STATUS_TONE } from "./homeworkFormat";
import useApiData from "./useApiData";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

/**
 * One homework: what to do, by when, and its files. Staff who manage it can change it, publish it
 * now or at a set time, and withdraw it (it is kept). Students see it once published.
 */
const HomeworkDetail = ({ id }: { id: string }) => {
  const t = useTranslations("homework");
  const tErrors = useTranslations("homework.errors");
  const format = useFormat();
  const { triggerToast } = useToast();
  const { handleError } = useApiError();
  const { data: homework, failed, reload, setData: setHomework } = useApiData<HomeworkItem>(`/homework/${id}`);
  const [editing, setEditing] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("08:00");
  const [withdrawing, setWithdrawing] = useState(false);
  const [busy, setBusy] = useState(false);

  const act = async (path: "publish" | "cancel", body: Record<string, unknown>, done: string) => {
    setBusy(true);
    try {
      setHomework((await axiosReq.post<{ payload: HomeworkItem }>(`${baseUrl}/homework/${id}/${path}`, body)).data.payload);
      triggerToast({ title: t("savedTitle"), description: done, type: "success" });
      setScheduling(false);
      setWithdrawing(false);
    } catch (error) {
      const code = (error as AxiosError<ApiError & { code?: string }>).response?.data?.code;
      if (code && (HOMEWORK_FORM_ERRORS as readonly string[]).includes(code)) triggerToast({ title: t("notSavedTitle"), description: tErrors(code as never), type: "error" });
      else handleError(error as AxiosError<ApiError>);
    } finally {
      setBusy(false);
    }
  };

  if (failed !== null) {
    return failed === 404 ? (
      <Card>
        <ErrorState title={t("notFound")} />
      </Card>
    ) : (
      <ErrorState title={t("loadFailed")} onRetry={reload} />
    );
  }
  if (!homework) {
    return (
      <Card aria-busy="true">
        <Skeleton lines={6} />
      </Card>
    );
  }

  const due = dueState(homework.due_at);
  const canPublish = homework.can_edit && (homework.status === "DRAFT" || homework.status === "SCHEDULED");
  const facts: [string, string][] = [
    [t("detail.subject"), homework.subject.name],
    [t("detail.type"), t(`editor.types.${homework.submission_type}`)],
    [t("detail.marks"), homework.total_marks === null ? t("detail.notScored") : format.number(homework.total_marks)],
  ];
  if (homework.can_edit || homework.targets.some((target) => target.section_label)) facts.push([t("detail.classes"), classesLabel(homework)]);
  if (homework.can_edit) facts.push([t("detail.students"), format.number(homework.student_count)]);

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader
        title={homework.title}
        description={<Link href="/homework">{t("back")}</Link>}
        actions={
          homework.can_edit ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setEditing(true)}>
                {t("detail.edit")}
              </Button>
              {canPublish ? (
                <>
                  <Button variant="secondary" onClick={() => setScheduling(true)}>
                    {t("detail.schedule")}
                  </Button>
                  <Button loading={busy && !scheduling && !withdrawing} disabled={busy} onClick={() => void act("publish", {}, t("published"))}>
                    {t("detail.publishNow")}
                  </Button>
                </>
              ) : null}
            </div>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        {homework.can_edit ? <StatusPill tone={STATUS_TONE[homework.status]}>{t(`statuses.${homework.status}`)}</StatusPill> : null}
        <StatusPill tone={DUE_TONE[due]}>{homework.due_at ? t(`due.${due}`, { when: format.dateTime(homework.due_at) }) : t("due.none")}</StatusPill>
        {homework.status === "SCHEDULED" && homework.publish_at ? (
          <span className="text-body-sm text-ink-muted">{t("detail.scheduledFor", { when: format.dateTime(homework.publish_at) })}</span>
        ) : null}
      </div>

      <Card>
        <dl className="grid gap-3 sm:grid-cols-2">
          {facts.map(([label, value]) => (
            <div key={label} className="flex flex-col gap-0.5">
              <dt className="text-caption text-ink-muted">{label}</dt>
              <dd className="text-body text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card title={t("detail.instructions")}>
        {homework.instructions?.html ? <RichTextContent html={homework.instructions.html} /> : <p className="text-body-sm text-ink-muted">{t("detail.noInstructions")}</p>}
      </Card>

      {homework.attachments.length > 0 ? (
        <Card title={t("detail.attachments")}>
          <ul className="flex flex-col gap-2">
            {homework.attachments.map((file) => (
              <li key={file.id} className="flex items-center justify-between gap-3">
                <a href={`${baseUrl}/files/${file.id}/content`} target="_blank" rel="noreferrer" className="truncate text-primary underline">
                  {file.name ?? t("detail.file")}
                </a>
                {file.size_bytes ? <span className="shrink-0 text-caption text-ink-muted">{format.fileSize(file.size_bytes)}</span> : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {homework.can_edit && homework.status !== "CANCELLED" ? (
        <div>
          <Button variant="ghost" className="text-danger" onClick={() => setWithdrawing(true)}>
            {t("detail.withdraw")}
          </Button>
        </div>
      ) : null}

      <HomeworkEditor
        open={editing}
        homework={homework}
        onClose={() => setEditing(false)}
        onSaved={(saved) => {
          setEditing(false);
          setHomework(saved);
          triggerToast({ title: t("savedTitle"), description: t(saved.status === "PUBLISHED" && homework.status !== "PUBLISHED" ? "published" : "saved"), type: "success" });
        }}
      />

      <Modal
        open={scheduling}
        onClose={() => setScheduling(false)}
        title={t("detail.scheduleTitle")}
        description={t("detail.scheduleHint")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setScheduling(false)}>
              {t("editor.cancel")}
            </Button>
            <Button
              loading={busy}
              disabled={!scheduleDate || busy}
              onClick={() => void act("publish", { publish_at: fromZonedParts(scheduleDate, scheduleTime) }, t("scheduled"))}
            >
              {t("detail.schedule")}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <DatePicker label={t("detail.scheduleDate")} value={scheduleDate} onChange={setScheduleDate} />
          <TimePicker label={t("detail.scheduleTime")} value={scheduleTime} onChange={setScheduleTime} />
        </div>
      </Modal>

      <ConfirmDialog
        open={withdrawing}
        tone="danger"
        title={t("detail.withdrawTitle")}
        description={t("detail.withdrawDetail")}
        confirmLabel={t("detail.withdraw")}
        loading={busy}
        onCancel={() => setWithdrawing(false)}
        onConfirm={() => void act("cancel", {}, t("withdrawn"))}
      />
    </div>
  );
};

export default HomeworkDetail;
