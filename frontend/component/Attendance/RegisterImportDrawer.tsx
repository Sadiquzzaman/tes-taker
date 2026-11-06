"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button, Checkbox, Drawer, FileDrop, StatusPill, Table, type TableColumn } from "@/design/ui";
import { useApiError } from "@/hooks/api/useApiError";
import useFormat from "@/i18n/useFormat";
import axiosReq from "@/lib/axios";
import { useToast } from "@/component/Toast/ToastContext";
import { isRegisterError, MAX_REGISTER_COLUMNS, MAX_REGISTER_ROWS, registerRowsFromCsv } from "@/utils/attendance/paperRegister";

interface RegisterImportDrawerProps {
  open: boolean;
  register: PaperRegisterView;
  onClose: () => void;
  onImported: (summary: PaperRegisterPreview["summary"]) => void;
}

type CsvFile = ReturnType<typeof registerRowsFromCsv> & { name: string };
type PreviewRow = PaperRegisterPreview["rows"][number];

/**
 * Paper register import (ATT-17): choose the filled-in CSV, see every column, row and cell checked
 * (unknown students, days with no class, holidays, cancelled classes, unknown letters…) and what
 * the import will change, then import. Nothing is saved while anything has a problem; importing
 * the same file again changes nothing. Self check-ins the file disagrees with are kept unless the
 * box to replace them is ticked.
 */
const RegisterImportDrawer = ({ open, register, onClose, onImported }: RegisterImportDrawerProps) => {
  const t = useTranslations("register.importer");
  const tStatus = useTranslations("register.status");
  const tErrors = useTranslations("register.errors");
  const { triggerToast } = useToast();
  const format = useFormat();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const { handleError } = useApiError();
  /** The register's own error codes are explained in its words; anything else as usual. */
  const explain = (error: AxiosError<ApiError>) => {
    const code = error.response?.data?.code;
    if (isRegisterError(code)) triggerToast({ title: tErrors(code), type: "error" });
    else handleError(error);
  };
  const [file, setFile] = useState<CsvFile | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PaperRegisterPreview | null>(null);
  const [overwrite, setOverwrite] = useState(false);
  const [busy, setBusy] = useState(false);
  const path = `${baseUrl}/attendance/register/sections/${register.section.id}`;

  const reset = () => {
    setFile(null);
    setFileError(null);
    setPreview(null);
    setOverwrite(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const body = (csv: CsvFile, overwriteCheckIns: boolean) => ({
    month: register.month,
    header: csv.header,
    rows: csv.rows,
    file_name: csv.name,
    overwrite_check_ins: overwriteCheckIns,
  });

  const check = async (chosen: File) => {
    reset();
    const parsed = { ...registerRowsFromCsv(await chosen.text()), name: chosen.name };
    setFile(parsed);
    if (parsed.rows.length === 0) return setFileError(t("noRows"));
    if (parsed.rows.length > MAX_REGISTER_ROWS) return setFileError(t("tooManyRows", { max: MAX_REGISTER_ROWS }));
    if (parsed.header.length > MAX_REGISTER_COLUMNS) return setFileError(t("tooManyColumns", { max: MAX_REGISTER_COLUMNS }));
    setBusy(true);
    try {
      const response = await axiosReq.post<ApiResponse<PaperRegisterPreview>>(`${path}/preview`, body(parsed, false));
      setPreview(response.data?.payload ?? null);
    } catch (error) {
      const code = (error as AxiosError<ApiError>).response?.data?.code;
      if (code === "ATTENDANCE_REGISTER_COLUMNS_MISSING") setFileError(t("missingColumns"));
      else explain(error as AxiosError<ApiError>);
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const response = await axiosReq.post<ApiResponse<PaperRegisterPreview>>(`${path}/import`, body(file, overwrite));
      const summary = response.data?.payload?.summary ?? { new: 0, changed: 0, unchanged: 0, kept: 0, check_ins: 0 };
      reset();
      onImported(summary);
    } catch (error) {
      explain(error as AxiosError<ApiError>);
    } finally {
      setBusy(false);
    }
  };

  const headerOf = (column: number) => preview?.columns.find((item) => item.column === column)?.header ?? format.number(column);
  /** What to say about a row: its own problem, its cells' problems and notes, or what the import does. */
  const messages = (row: PreviewRow) => {
    const problems = [
      ...row.issues.map((code) => t(`issues.${code}`)),
      ...row.cells.flatMap((cell) => cell.issues.map((code) => `${headerOf(cell.column)}: ${t(`issues.${code}`, { value: cell.value })}`)),
    ];
    const notes = [
      ...row.notes.map((code) => t(`notes.${code}`)),
      ...row.cells.flatMap((cell) =>
        cell.notes.map((code) =>
          `${headerOf(cell.column)}: ${t(`notes.${code}`, { old: cell.old_status ? tStatus(cell.old_status) : "", new: cell.status ? tStatus(cell.status) : "" })}`,
        ),
      ),
    ];
    return { problems, notes };
  };

  const columns: TableColumn<PreviewRow>[] = [
    { key: "row", header: t("columns.row"), cell: (row) => format.number(row.row), sortValue: (row) => row.row },
    {
      key: "student",
      header: t("columns.student"),
      cell: (row) => (
        <span className="text-ink">{row.student ? `${row.student.roll_no ? `${row.student.roll_no} · ` : ""}${row.student.full_name}` : [row.roll_no, row.name].filter(Boolean).join(" · ") || "—"}</span>
      ),
    },
    {
      key: "changes",
      header: t("columns.changes"),
      cell: (row) => {
        const changes = row.cells.filter((cell) => cell.change === "NEW" || cell.change === "CHANGE").length;
        return format.number(changes);
      },
    },
    {
      key: "status",
      header: t("columns.status"),
      cell: (row) => {
        const { problems, notes } = messages(row);
        const blocking = problems.length > 0 && (row.marks > 0 || row.cells.some((cell) => cell.issues.length > 0));
        return (
          <div className="flex flex-col items-start gap-1">
            {blocking ? <StatusPill tone="danger">{t("hasErrors")}</StatusPill> : problems.length > 0 ? <StatusPill tone="neutral">{t("ignored")}</StatusPill> : <StatusPill tone="success">{t("ok")}</StatusPill>}
            {problems.map((text) => (
              <span key={text} className={blocking ? "text-body-sm text-danger" : "text-body-sm text-ink-muted"}>
                {text}
              </span>
            ))}
            {notes.map((text) => (
              <span key={text} className="text-body-sm text-warning">
                {text}
              </span>
            ))}
          </div>
        );
      },
    },
  ];

  const badColumns = preview?.columns.filter((column) => column.issues.length > 0) ?? [];
  const summary = preview?.summary;
  const writes = summary ? summary.new + summary.changed + (overwrite ? summary.check_ins : 0) : 0;

  return (
    <Drawer
      open={open}
      wide
      onClose={close}
      title={t("title", { section: `${register.section.class_name} ${register.section.name}`, month: format.date(`${register.month}-01T00:00:00Z`, { month: "long", year: "numeric", timeZone: "UTC" }) })}
      description={t("intro")}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            {t("cancel")}
          </Button>
          <Button onClick={() => void submit()} disabled={!preview?.valid || writes === 0} loading={busy && Boolean(preview)}>
            {t("importCount", { count: writes })}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-body-sm text-ink-muted">{t("columnsHint")}</p>
        <FileDrop
          label={t("file")}
          accept=".csv,text/csv"
          acceptLabel={t("fileTypes")}
          maxSizeMb={2}
          items={file ? [{ id: file.name, name: file.name, error: fileError ?? undefined }] : []}
          onRemove={reset}
          onFiles={(files) => files[0] && void check(files[0])}
          disabled={busy}
        />

        {preview && summary ? (
          <>
            <p role="status" className={preview.valid ? "text-body text-ink" : "text-body text-danger"}>
              {preview.valid ? (writes > 0 ? t("previewReady") : t("nothingToChange")) : t("previewProblems")}
            </p>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 rounded-card bg-canvas p-3 text-body-sm text-ink">
              <li>{t("summary.new", { count: summary.new })}</li>
              <li>{t("summary.changed", { count: summary.changed })}</li>
              <li>{t("summary.unchanged", { count: summary.unchanged })}</li>
              {summary.kept > 0 ? <li>{t("summary.kept", { count: summary.kept })}</li> : null}
            </ul>
            {summary.check_ins > 0 ? (
              <Checkbox
                checked={overwrite}
                onChange={(event) => setOverwrite(event.target.checked)}
                label={t("overwrite", { count: summary.check_ins })}
                hint={t("overwriteHint")}
              />
            ) : null}
            {badColumns.length > 0 ? (
              <div className="flex flex-col gap-1 rounded-card border border-border p-3">
                <span className="text-body-sm font-medium text-ink">{t("columnProblems")}</span>
                {badColumns.map((column) => (
                  <span key={column.column} className={column.marks > 0 ? "text-body-sm text-danger" : "text-body-sm text-ink-muted"}>
                    {`${column.header || format.number(column.column)}: ${column.issues
                      .map((code) => (code === "CLOSED_DAY" && column.closed ? t(`closed.${column.closed}`) : t(`issues.${code}`, { value: "" })))
                      .join(" ")}${column.marks > 0 ? "" : ` ${t("emptyIgnored")}`}`}
                  </span>
                ))}
              </div>
            ) : null}
            <Table caption={t("tableCaption")} columns={columns} rows={preview.rows} getRowId={(row) => String(row.row)} defaultSort={{ key: "row", direction: "asc" }} />
          </>
        ) : null}
      </div>
    </Drawer>
  );
};

export default RegisterImportDrawer;
