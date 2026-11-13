"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import useApiData from "@/component/Homework/useApiData";
import { useToast } from "@/component/Toast/ToastContext";
import { Button, Card, Checkbox, ConfirmDialog, ErrorState, Input, PageHeader, Skeleton, StatusPill } from "@/design/ui";
import { useApiError } from "@/hooks/api/useApiError";
import useFormat from "@/i18n/useFormat";
import axiosReq from "@/lib/axios";
import { downloadCsv } from "@/utils/attendance/paperRegister";
import { marksCsv, marksFileName, marksFromCsv } from "@/utils/marks/marksCsv";
import PaperExamDrawer from "./PaperExamDrawer";

/** One student's marks as typed: per part (or "marks"), and absent. */
type Draft = { values: Record<string, string>; absent: boolean };

const draftOf = (row: PaperMarkRow, exam: PaperExam): Draft => ({
  values: exam.parts?.length
    ? Object.fromEntries(exam.parts.map((part) => [part.name, row.part_marks?.[part.name] !== undefined ? String(row.part_marks[part.name]) : ""]))
    : { marks: row.marks === null ? "" : String(row.marks) },
  absent: row.is_absent,
});

/**
 * A paper exam's marks (PRF-03): one line per student taking the subject class, marks per part
 * (the total is their sum) or out of the total, or absent; save all at once, download the sheet to
 * fill in on paper or in Excel and import it, and publish the marks for the students.
 */
const MarksGrid = ({ id }: { id: string }) => {
  const t = useTranslations("marks");
  const tErrors = useTranslations("marks.errors");
  const format = useFormat();
  const router = useRouter();
  const { triggerToast } = useToast();
  const { handleError } = useApiError();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const { data: grid, failed, reload, setData } = useApiData<PaperMarksGrid>(`/offline-exams/${id}/marks`);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState<"publish" | "remove" | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (grid) setDrafts(Object.fromEntries(grid.rows.map((row) => [row.student.id, draftOf(row, grid.exam)])));
  }, [grid]);

  const changed = useMemo(() => {
    if (!grid) return [];
    return grid.rows.filter((row) => JSON.stringify(drafts[row.student.id]) !== JSON.stringify(draftOf(row, grid.exam)));
  }, [drafts, grid]);

  if (failed !== null) return <ErrorState title={t("loadFailed")} onRetry={reload} />;
  if (!grid) {
    return (
      <Card aria-busy="true">
        <Skeleton lines={6} />
      </Card>
    );
  }
  const { exam } = grid;
  const parts = exam.parts?.length ? exam.parts : null;
  const columns = parts ? parts.map((part) => ({ key: part.name, label: part.name, max: part.marks })) : [{ key: "marks", label: t("marksColumn"), max: exam.total_marks }];
  const readOnly = !exam.can_edit;

  const toInput = (studentId: string): PaperMarkInput => {
    const draft = drafts[studentId];
    if (draft.absent) return { student_id: studentId, is_absent: true };
    if (parts) {
      const partMarks: Record<string, number> = {};
      for (const part of parts) if (draft.values[part.name] !== "") partMarks[part.name] = Number(draft.values[part.name]);
      return { student_id: studentId, part_marks: partMarks, is_absent: false };
    }
    return { student_id: studentId, marks: draft.values.marks === "" ? null : Number(draft.values.marks), is_absent: false };
  };

  const send = async (rows: PaperMarkInput[]) => {
    setSaving(true);
    setError(null);
    try {
      const response = await axiosReq.put<ApiResponse<PaperMarksGrid>>(`${baseUrl}/offline-exams/${id}/marks`, { rows });
      setData(response.data.payload);
      triggerToast({ title: t("saved"), type: "success" });
      return true;
    } catch (err) {
      const data = (err as AxiosError<ApiError & { code?: string; details?: { index?: number } }>).response?.data;
      if (data?.code && data.code.startsWith("OFFLINE_EXAM_")) {
        const row = data.details?.index !== undefined ? grid.rows.find((r) => r.student.id === rows[data.details!.index!]?.student_id) : undefined;
        setError(row ? t("errorFor", { name: row.student.full_name, error: tErrors(data.code as never) }) : tErrors(data.code as never));
      } else handleError(err as AxiosError<ApiError>);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const importSheet = async (file: File) => {
    const { rows, problems } = marksFromCsv(await file.text(), grid);
    if (problems.length) {
      setError(problems.map((problem) => t(`sheet.${problem.reason}`, { line: problem.line })).join(" "));
      return;
    }
    if (rows.length === 0) {
      setError(t("sheet.EMPTY"));
      return;
    }
    if (await send(rows)) triggerToast({ title: t("imported", { count: rows.length }), type: "success" });
  };

  const publish = async () => {
    try {
      await axiosReq.post(`${baseUrl}/offline-exams/${id}/publish`);
      triggerToast({ title: t("publishedToast"), type: "success" });
      reload();
    } catch (err) {
      handleError(err as AxiosError<ApiError>);
    } finally {
      setConfirm(null);
    }
  };

  const remove = async () => {
    try {
      await axiosReq.delete(`${baseUrl}/offline-exams/${id}`);
      triggerToast({ title: t("removed"), type: "success" });
      router.push("/marks");
    } catch (err) {
      handleError(err as AxiosError<ApiError>);
      setConfirm(null);
    }
  };

  const setValue = (studentId: string, key: string, value: string) =>
    setDrafts((current) => ({ ...current, [studentId]: { ...current[studentId], values: { ...current[studentId].values, [key]: value } } }));

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader
        title={exam.name}
        description={[
          exam.offering.subject.name,
          `${exam.offering.section.class_name ?? ""} ${exam.offering.section.name}`.trim(),
          format.date(`${exam.exam_date}T00:00:00Z`, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }),
          t("outOf", { total: exam.total_marks }),
          exam.term?.name,
        ]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => downloadCsv(marksFileName(exam), marksCsv(grid))}>
              {t("downloadSheet")}
            </Button>
            {readOnly ? null : (
              <>
                <Button variant="secondary" onClick={() => fileRef.current?.click()}>
                  {t("importSheet")}
                </Button>
                <Button variant="secondary" onClick={() => setEditing(true)}>
                  {t("edit")}
                </Button>
                {exam.published_at ? null : <Button onClick={() => setConfirm("publish")}>{t("publish")}</Button>}
              </>
            )}
          </div>
        }
      />
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        aria-label={t("importSheet")}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void importSheet(file);
        }}
      />
      <div className="flex flex-wrap items-center gap-3">
        <StatusPill tone={exam.published_at ? "success" : "neutral"}>{t(exam.published_at ? "published" : "notPublished")}</StatusPill>
        <span className="text-body-sm text-ink-muted">{t("entered", { entered: exam.counts.entered, students: exam.counts.students })}</span>
        {parts ? <span className="text-body-sm text-ink-muted">{t("partsOf", { parts: parts.map((part) => `${part.name} ${format.number(part.marks)}`).join(" + ") })}</span> : null}
        {readOnly ? <span className="text-body-sm text-ink-muted">{t("readOnly")}</span> : null}
      </div>
      <Card flush>
        <div className="overflow-x-auto">
          <table className="w-full text-body-sm">
            <caption className="sr-only">{t("gridCaption", { name: exam.name })}</caption>
            <thead>
              <tr className="border-b border-border text-left text-caption text-ink-muted">
                <th scope="col" className="px-3 py-2">
                  {t("roll")}
                </th>
                <th scope="col" className="px-3 py-2">
                  {t("student")}
                </th>
                {columns.map((column) => (
                  <th key={column.key} scope="col" className="px-3 py-2">
                    {`${column.label} (${format.number(column.max)})`}
                  </th>
                ))}
                <th scope="col" className="px-3 py-2">
                  {t("absent")}
                </th>
                <th scope="col" className="px-3 py-2 text-right">
                  {t("result")}
                </th>
              </tr>
            </thead>
            <tbody>
              {grid.rows.map((row) => {
                const draft = drafts[row.student.id];
                if (!draft) return null;
                return (
                  <tr key={row.student.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 text-ink-muted">{row.student.roll_no ?? "—"}</td>
                    <th scope="row" className="px-3 py-2 text-left font-medium text-ink">
                      {row.student.full_name}
                    </th>
                    {columns.map((column) => (
                      <td key={column.key} className="px-3 py-2">
                        <Input
                          label={t("marksFor", { part: column.label, name: row.student.full_name })}
                          hideLabel
                          type="number"
                          min={0}
                          max={column.max}
                          step="0.5"
                          fieldClassName="w-24"
                          value={draft.values[column.key] ?? ""}
                          disabled={readOnly || draft.absent}
                          onChange={(event) => setValue(row.student.id, column.key, event.target.value)}
                        />
                      </td>
                    ))}
                    <td className="px-3 py-2">
                      <Checkbox
                        label={<span className="sr-only">{t("absentFor", { name: row.student.full_name })}</span>}
                        checked={draft.absent}
                        disabled={readOnly}
                        onChange={(event) => setDrafts((current) => ({ ...current, [row.student.id]: { ...current[row.student.id], absent: event.target.checked } }))}
                      />
                    </td>
                    <td className="px-3 py-2 text-right text-ink">
                      {row.is_absent ? t("absent") : row.percent === null ? "—" : `${format.number(row.marks ?? 0)} · ${format.number(row.percent)}%${row.grade ? ` (${row.grade.grade})` : ""}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      {error ? (
        <p role="alert" className="text-body-sm text-danger">
          {error}
        </p>
      ) : null}
      {readOnly ? null : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" className="text-danger" onClick={() => setConfirm("remove")}>
            {t("remove")}
          </Button>
          <div className="flex items-center gap-3">
            <span className="text-body-sm text-ink-muted">{t("unsaved", { count: changed.length })}</span>
            <Button loading={saving} disabled={changed.length === 0} onClick={() => void send(changed.map((row) => toInput(row.student.id)))}>
              {t("saveMarks")}
            </Button>
          </div>
        </div>
      )}
      <PaperExamDrawer
        open={editing}
        exam={exam}
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          triggerToast({ title: t("examSaved"), type: "success" });
          reload();
        }}
      />
      <ConfirmDialog
        open={confirm === "publish"}
        title={t("publishTitle")}
        description={t("publishDetail", { count: exam.counts.students - exam.counts.entered })}
        confirmLabel={t("publish")}
        onConfirm={() => void publish()}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === "remove"}
        title={t("removeTitle")}
        description={t("removeDetail")}
        confirmLabel={t("remove")}
        tone="danger"
        onConfirm={() => void remove()}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
};

export default MarksGrid;
