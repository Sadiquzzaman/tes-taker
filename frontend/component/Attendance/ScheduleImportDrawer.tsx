"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button, Drawer, FileDrop, StatusPill, Table, type TableColumn } from "@/design/ui";
import useAcademicsRequest from "@/hooks/academics/useAcademicsRequest";
import { useApiError } from "@/hooks/api/useApiError";
import useFormat from "@/i18n/useFormat";
import axiosReq from "@/lib/axios";
import { downloadScheduleImportTemplate, MAX_SCHEDULE_ROWS, scheduleRowsFromCsv, type ScheduleImportRow } from "@/utils/attendance/scheduleImport";
import type { IsoDay } from "@/utils/schoolDate";

interface ScheduleImportDrawerProps {
  open: boolean;
  sessionId: string;
  onClose: () => void;
  onImported: (sections: number) => void;
}

/**
 * Schedule CSV import (ATT-16): download the template, choose a file, see every row checked and what
 * each section will get, then import. Nothing is saved while any row has a problem; each section in
 * the file gets exactly its listed times, so importing the same file again changes nothing.
 */
const ScheduleImportDrawer = ({ open, sessionId, onClose, onImported }: ScheduleImportDrawerProps) => {
  const t = useTranslations("classSetup.import");
  const tSetup = useTranslations("classSetup");
  const format = useFormat();
  const { baseUrl, run } = useAcademicsRequest();
  const { handleError } = useApiError();
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [rows, setRows] = useState<ScheduleImportRow[]>([]);
  const [preview, setPreview] = useState<ScheduleImportPreview | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setFileName(null);
    setFileError(null);
    setRows([]);
    setPreview(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const check = async (file: File) => {
    reset();
    setFileName(file.name);
    const parsed = scheduleRowsFromCsv(await file.text());
    if (parsed.missing.length > 0) return setFileError(t("missingColumns", { columns: parsed.missing.join(", ") }));
    if (parsed.rows.length === 0) return setFileError(t("noRows"));
    if (parsed.rows.length > MAX_SCHEDULE_ROWS) return setFileError(t("tooManyRows", { max: MAX_SCHEDULE_ROWS }));
    setRows(parsed.rows);
    setBusy(true);
    const response = await run(() =>
      axiosReq.post<ApiResponse<ScheduleImportPreview>>(`${baseUrl}/attendance/setup/import/preview`, { session_id: sessionId, rows: parsed.rows }),
    );
    setBusy(false);
    if (response?.data?.payload) setPreview(response.data.payload);
  };

  const submit = async () => {
    setBusy(true);
    try {
      const response = await axiosReq.post<ApiResponse<ScheduleImportPreview>>(`${baseUrl}/attendance/setup/import`, { session_id: sessionId, rows });
      const count = response.data?.payload?.sections.length ?? 0;
      reset();
      onImported(count);
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    } finally {
      setBusy(false);
    }
  };

  const time = (value: string | null) => {
    if (!value) return "—";
    const [h, m] = value.split(":").map(Number);
    return `${format.twoDigits(h)}:${format.twoDigits(m)}`;
  };

  const columns: TableColumn<ScheduleImportRowResult>[] = [
    { key: "row", header: t("columns.row"), cell: (row) => format.number(row.row), sortValue: (row) => row.row },
    { key: "section", header: t("columns.section"), cell: (row) => [row.class, row.section].filter(Boolean).join(" ") || "—" },
    {
      key: "time",
      header: t("columns.time"),
      cell: (row) =>
        row.days.length > 0 || row.start ? (
          <span>
            {row.days.map((day) => tSetup(`dayShort.${day as IsoDay}`)).join(", ")} {`${time(row.start)}–${time(row.end)}`}
          </span>
        ) : (
          "—"
        ),
    },
    {
      key: "status",
      header: t("columns.status"),
      cell: (row) =>
        row.errors.length === 0 ? (
          <StatusPill tone="success">{t("ok")}</StatusPill>
        ) : (
          <div className="flex flex-col items-start gap-1">
            <StatusPill tone="danger">{t("hasErrors")}</StatusPill>
            {row.errors.map((code) => (
              <span key={code} className="text-body-sm text-danger">
                {t(`issues.${code}`)}
              </span>
            ))}
          </div>
        ),
    },
  ];

  const problems = preview?.rows.filter((row) => row.errors.length > 0).length ?? 0;

  return (
    <Drawer
      open={open}
      wide
      onClose={close}
      title={t("title")}
      description={t("intro")}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            {t("cancel")}
          </Button>
          <Button onClick={() => void submit()} disabled={!preview?.valid || preview.sections.length === 0} loading={busy && Boolean(preview)}>
            {t("importCount", { count: preview?.sections.length ?? 0 })}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-body-sm text-ink-muted">{t("columnsHint")}</p>
          <Button variant="secondary" size="sm" onClick={downloadScheduleImportTemplate}>
            {t("template")}
          </Button>
        </div>
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

        {preview ? (
          <>
            <p role="status" className={problems > 0 ? "text-body text-danger" : "text-body text-ink"}>
              {problems > 0
                ? t("previewProblems", { count: problems })
                : t("previewReady", { sections: preview.sections.length, session: preview.session.name })}
            </p>
            {preview.valid && preview.sections.length > 0 ? (
              <ul className="flex flex-col gap-1 rounded-card bg-canvas p-3 text-body-sm">
                {preview.sections.map((section) => (
                  <li key={section.id} className="flex flex-wrap justify-between gap-2">
                    <span className="font-medium text-ink">{`${section.class_name} ${section.name}`}</span>
                    <span className="text-ink-muted">
                      {t("sectionPlan", { before: section.slots_before, after: section.slots_after })}
                      {section.settings_changed ? ` · ${t("settingsChanged")}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            <Table caption={t("title")} columns={columns} rows={preview.rows} getRowId={(row) => String(row.row)} defaultSort={{ key: "row", direction: "asc" }} />
          </>
        ) : null}
      </div>
    </Drawer>
  );
};

export default ScheduleImportDrawer;
