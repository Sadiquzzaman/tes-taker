"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button, Checkbox, Drawer, FileDrop, StatusPill, Table, type BadgeTone, type TableColumn } from "@/design/ui";
import useAcademicsRequest from "@/hooks/academics/useAcademicsRequest";
import axiosReq from "@/lib/axios";
import { downloadStudentImportTemplate, MAX_IMPORT_ROWS, studentRowsFromCsv, type StudentImportRow } from "@/utils/academics/studentImport";

const PLAN_TONE: Record<NonNullable<ImportRowResult["plan"]>, BadgeTone> = { ENROL: "success", PENDING: "warning", INVITE: "info" };
const OUTCOME_TONE: Record<NonNullable<ImportRowResult["outcome"]>, BadgeTone> = {
  ENROLLED: "success",
  PENDING: "warning",
  INVITED: "info",
  SKIPPED: "neutral",
};

/**
 * Student CSV import into this class's sections (FND-04): choose a file, see every row checked
 * before anything is saved (problems per row, the plan's student limit), then import the rows that
 * pass. Invitations to students without an account are sent only when ticked (SMS uses credits).
 */
const StudentImportDrawer = ({ classId, sessionId, onClose, onImported }: { classId: string; sessionId: string; onClose: () => void; onImported: () => void }) => {
  const t = useTranslations("academics.import");
  const { baseUrl, run } = useAcademicsRequest();
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [rows, setRows] = useState<StudentImportRow[]>([]);
  const [preview, setPreview] = useState<ImportSummary | null>(null);
  const [result, setResult] = useState<ImportSummary | null>(null);
  const [sendInvitations, setSendInvitations] = useState(false);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setFileName(null);
    setFileError(null);
    setRows([]);
    setPreview(null);
    setResult(null);
  };

  const check = async (file: File) => {
    reset();
    setFileName(file.name);
    const parsed = studentRowsFromCsv(await file.text());
    if (parsed.missing) return setFileError(t("missingColumns"));
    if (parsed.rows.length === 0) return setFileError(t("noRows"));
    if (parsed.rows.length > MAX_IMPORT_ROWS) return setFileError(t("tooManyRows", { max: MAX_IMPORT_ROWS }));
    setRows(parsed.rows);
    setBusy(true);
    const res = await run(() =>
      axiosReq.post<ApiResponse<ImportSummary>>(`${baseUrl}/classes/${classId}/students/import/preview`, { session_id: sessionId, rows: parsed.rows }),
    );
    setBusy(false);
    if (res?.data?.payload) setPreview(res.data.payload);
  };

  const submit = async () => {
    setBusy(true);
    const res = await run(() =>
      axiosReq.post<ApiResponse<ImportSummary>>(`${baseUrl}/classes/${classId}/students/import`, {
        session_id: sessionId,
        rows,
        send_invitations: sendInvitations,
      }),
    );
    setBusy(false);
    if (res?.data?.payload) {
      setResult(res.data.payload);
      onImported();
    }
  };

  const issueText = (issue: ImportRowResult["errors"][number] | ImportRowResult["warnings"][number]) => {
    const text = t(`issues.${issue.code}`);
    return issue.guardian ? t("guardianIssue", { n: issue.guardian, issue: text }) : text;
  };

  const shown = result ?? preview;
  const columns: TableColumn<ImportRowResult>[] = [
    { key: "name", header: t("columns.name"), cell: (row) => row.name || "—" },
    { key: "row", header: t("columns.row"), cell: (row) => row.row, sortValue: (row) => row.row },
    { key: "contact", header: t("columns.contact"), cell: (row) => row.contact || "—", hideOnMobile: true },
    { key: "section", header: t("columns.section"), cell: (row) => [row.section, row.roll_no].filter(Boolean).join(" · ") || "—" },
    {
      key: "status",
      header: t("columns.status"),
      cell: (row) => (
        <div className="flex flex-col items-start gap-1">
          {row.outcome ? (
            <StatusPill tone={OUTCOME_TONE[row.outcome]}>{t(`outcomes.${row.outcome}`)}</StatusPill>
          ) : row.plan ? (
            <StatusPill tone={PLAN_TONE[row.plan]}>{t(`plans.${row.plan}`)}</StatusPill>
          ) : (
            <StatusPill tone="danger">{t("hasErrors")}</StatusPill>
          )}
          {row.errors.map((issue) => (
            <span key={`${issue.code}-${issue.guardian ?? 0}`} className="text-body-sm text-danger">
              {issueText(issue)}
            </span>
          ))}
          {row.warnings.map((issue) => (
            <span key={issue.code} className="text-body-sm text-ink-muted">
              {issueText(issue)}
            </span>
          ))}
          {row.guardians > 0 ? <span className="text-body-sm text-ink-muted">{t("guardianCount", { count: row.guardians })}</span> : null}
        </div>
      ),
    },
  ];

  const canImport = Boolean(preview && !result && preview.valid > 0 && !preview.limit.over);

  return (
    <Drawer
      open
      wide
      onClose={onClose}
      title={t("title")}
      description={t("intro")}
      footer={
        result ? (
          <Button onClick={onClose}>{t("done")}</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>
              {t("cancel")}
            </Button>
            <Button onClick={() => void submit()} disabled={!canImport} loading={busy && Boolean(preview)}>
              {t("importCount", { count: preview?.valid ?? 0 })}
            </Button>
          </>
        )
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-body-sm text-ink-muted">{t("columnsHint")}</p>
          <Button variant="secondary" size="sm" onClick={downloadStudentImportTemplate}>
            {t("template")}
          </Button>
        </div>
        {!result ? (
          <FileDrop
            label={t("file")}
            accept=".csv,text/csv"
            acceptLabel={t("fileTypes")}
            maxSizeMb={2}
            items={fileName ? [{ id: fileName, name: fileName, error: fileError ?? undefined }] : []}
            onRemove={reset}
            onFiles={(files) => files[0] && void check(files[0])}
            disabled={busy}
          />
        ) : null}

        {shown ? (
          <>
            <p role="status" className="text-body text-ink">
              {result
                ? t("resultSummary", { imported: result.valid, skipped: result.invalid, sent: result.invitations_sent ?? 0 })
                : t("previewSummary", { session: shown.session.name, valid: shown.valid, invalid: shown.invalid })}
            </p>
            {!result && shown.limit.over ? (
              <p role="alert" className="rounded-card border border-danger p-3 text-body-sm text-danger">
                {t("overLimit", { max: shown.limit.max, current: shown.limit.current, adding: shown.limit.adding })}
              </p>
            ) : null}
            {!result && shown.valid > 0 ? (
              <Checkbox
                label={t("sendInvitations")}
                hint={t("sendInvitationsHint")}
                checked={sendInvitations}
                onChange={(e) => setSendInvitations(e.target.checked)}
              />
            ) : null}
            <Table caption={t("title")} columns={columns} rows={shown.rows} getRowId={(row) => String(row.row)} defaultSort={{ key: "row", direction: "asc" }} />
          </>
        ) : null}
      </div>
    </Drawer>
  );
};

export default StudentImportDrawer;
