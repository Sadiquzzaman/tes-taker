"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { RichTextEditor } from "@/component/RichTextEditor";
import { Button, Checkbox, DatePicker, Drawer, FileDrop, type FileDropItem, Input, RadioGroup, Skeleton, TimePicker } from "@/design/ui";
import { useApiError } from "@/hooks/api/useApiError";
import { fromZonedParts, toZonedParts } from "@/i18n/zonedTime";
import axiosReq from "@/lib/axios";
import { uploadMedia } from "@/utils/media/uploadMedia";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
const TYPES: HomeworkType[] = ["FILE", "TEXT", "PAPER"];
/** The API's error codes the form explains itself (messages `homework.errors`). */
export const HOMEWORK_FORM_ERRORS = [
  "HOMEWORK_TARGETS_INVALID",
  "HOMEWORK_TARGETS_MIXED",
  "HOMEWORK_STUDENT_NOT_IN_CLASS",
  "HOMEWORK_SESSION_CLOSED",
  "HOMEWORK_FILE_INVALID",
  "HOMEWORK_DUE_INVALID",
  "HOMEWORK_WRONG_STATUS",
] as const;
type FormError = (typeof HOMEWORK_FORM_ERRORS)[number] | "TITLE_REQUIRED" | "CLASS_REQUIRED" | "UPLOAD_FAILED";

export interface HomeworkSubjectClass {
  offering_id: string;
  session_id: string;
  section_label: string;
  subject: { id: string; name: string };
}

interface RosterStudent {
  student_id: string;
  full_name: string;
  roll_no: string | null;
}

type Attachment = FileDropItem & { fileId?: string };

/**
 * Writes or changes a homework (HW-01): title, the subject classes (one subject) or chosen students
 * of them, instructions, how it is handed in, marks, due time and files. Saved as a draft; with
 * `publish` it is published straight after. A published homework keeps its classes and type.
 */
const HomeworkEditor = ({
  open,
  homework,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** The homework being changed; null for a new one. */
  homework: HomeworkItem | null;
  onClose: () => void;
  onSaved: (saved: HomeworkItem) => void;
}) => {
  const t = useTranslations("homework.editor");
  const tErrors = useTranslations("homework.errors");
  const { handleError } = useApiError();
  const locked = homework?.status === "PUBLISHED";

  const [choices, setChoices] = useState<HomeworkSubjectClass[] | null>(null);
  const [title, setTitle] = useState("");
  const [offeringIds, setOfferingIds] = useState<string[]>([]);
  const [someStudents, setSomeStudents] = useState(false);
  const [studentIds, setStudentIds] = useState<string[]>([]);
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [html, setHtml] = useState("");
  const [type, setType] = useState<HomeworkType>("FILE");
  const [marks, setMarks] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [error, setError] = useState<FormError | null>(null);
  const [saving, setSaving] = useState<"draft" | "publish" | null>(null);

  // Fill the form when it opens.
  useEffect(() => {
    if (!open) return;
    const due = toZonedParts(homework?.due_at);
    setTitle(homework?.title ?? "");
    setOfferingIds(homework?.targets.map((target) => target.offering_id) ?? []);
    const chosen = homework?.targets.flatMap((target) => target.student_ids ?? []) ?? [];
    setSomeStudents(chosen.length > 0);
    setStudentIds(chosen);
    setHtml(homework?.instructions?.html ?? "");
    setType(homework?.submission_type ?? "FILE");
    setMarks(homework?.total_marks == null ? "" : String(homework.total_marks));
    setDueDate(due.date);
    setDueTime(due.time || (homework ? "" : "23:59"));
    setAttachments((homework?.attachments ?? []).map((file) => ({ id: file.id, fileId: file.id, name: file.name ?? file.id, sizeBytes: file.size_bytes ?? undefined })));
    setError(null);
    setChoices(null);
    axiosReq
      .get<{ payload: HomeworkSubjectClass[] }>(`${baseUrl}/homework/subject-classes`)
      .then((res) => setChoices(res.data?.payload ?? []))
      .catch((err) => {
        setChoices([]);
        handleError(err as AxiosError<ApiError>);
      });
  }, [open, homework, handleError]);

  // The students taking the chosen subject classes, for "only some students".
  useEffect(() => {
    if (!open || !someStudents || offeringIds.length === 0) {
      setRoster([]);
      return;
    }
    let cancelled = false;
    Promise.all(offeringIds.map((id) => axiosReq.get<{ payload: RosterStudent[] }>(`${baseUrl}/offerings/${id}/roster`)))
      .then((responses) => {
        if (cancelled) return;
        const byId = new Map<string, RosterStudent>();
        for (const res of responses) for (const student of res.data?.payload ?? []) byId.set(student.student_id, student);
        setRoster([...byId.values()].sort((a, b) => a.full_name.localeCompare(b.full_name)));
      })
      .catch((err) => handleError(err as AxiosError<ApiError>));
    return () => {
      cancelled = true;
    };
  }, [open, someStudents, offeringIds, handleError]);

  const subjectId = useMemo(() => choices?.find((c) => offeringIds.includes(c.offering_id))?.subject.id ?? null, [choices, offeringIds]);
  const uploading = attachments.some((file) => !file.fileId && !file.error);

  const toggleOffering = (id: string, checked: boolean) => {
    setOfferingIds((current) => (checked ? [...current, id] : current.filter((value) => value !== id)));
    setStudentIds([]);
  };

  const addFiles = (files: File[]) => {
    for (const file of files) {
      const id = `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 7)}`;
      setAttachments((current) => [...current, { id, name: file.name, progress: 0 }]);
      uploadMedia("homework", file, undefined, {
        onProgress: (progress) => setAttachments((current) => current.map((item) => (item.id === id ? { ...item, progress } : item))),
      })
        .then((uploaded) =>
          setAttachments((current) =>
            current.map((item) => (item.id === id ? { ...item, fileId: uploaded.id, progress: undefined, sizeBytes: uploaded.size ?? undefined } : item)),
          ),
        )
        .catch(() => setAttachments((current) => current.map((item) => (item.id === id ? { ...item, error: tErrors("UPLOAD_FAILED"), progress: undefined } : item))));
    }
  };

  const save = async (publish: boolean) => {
    if (!title.trim()) return setError("TITLE_REQUIRED");
    if (offeringIds.length === 0) return setError("CLASS_REQUIRED");
    setError(null);
    setSaving(publish ? "publish" : "draft");
    const body: Partial<HomeworkInput> = {
      title: title.trim(),
      instructions: html.trim() ? { html } : null,
      total_marks: marks.trim() ? Number(marks) : null,
      due_at: dueDate ? fromZonedParts(dueDate, dueTime || "23:59") : null,
      attachment_ids: attachments.filter((file) => file.fileId).map((file) => file.fileId as string),
    };
    if (!locked) {
      body.submission_type = type;
      body.offering_ids = offeringIds;
      body.student_ids = someStudents ? studentIds : [];
    }
    try {
      const res = homework
        ? await axiosReq.patch<{ payload: HomeworkItem }>(`${baseUrl}/homework/${homework.id}`, body)
        : await axiosReq.post<{ payload: HomeworkItem }>(`${baseUrl}/homework`, body);
      let saved = res.data.payload;
      if (publish && saved.status !== "PUBLISHED") {
        saved = (await axiosReq.post<{ payload: HomeworkItem }>(`${baseUrl}/homework/${saved.id}/publish`, {})).data.payload;
      }
      onSaved(saved);
    } catch (err) {
      const code = (err as AxiosError<ApiError & { code?: string }>).response?.data?.code;
      if (code && (HOMEWORK_FORM_ERRORS as readonly string[]).includes(code)) setError(code as FormError);
      else handleError(err as AxiosError<ApiError>);
    } finally {
      setSaving(null);
    }
  };

  return (
    <Drawer
      wide
      open={open}
      onClose={onClose}
      title={homework ? t("editTitle") : t("newTitle")}
      description={locked ? t("publishedHint") : t("intro")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("cancel")}
          </Button>
          {homework?.status === "PUBLISHED" ? null : (
            <Button variant="secondary" loading={saving === "draft"} disabled={Boolean(saving) || uploading} onClick={() => void save(false)}>
              {t("saveDraft")}
            </Button>
          )}
          <Button loading={saving === "publish"} disabled={Boolean(saving) || uploading} onClick={() => void save(homework?.status !== "PUBLISHED")}>
            {homework?.status === "PUBLISHED" ? t("save") : t("publish")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {error ? (
          <p role="alert" className="rounded-input bg-danger-soft px-3 py-2 text-body-sm text-danger">
            {tErrors(error)}
          </p>
        ) : null}

        <Input label={t("title")} value={title} required maxLength={200} onChange={(event) => setTitle(event.target.value)} />

        <fieldset className="flex flex-col gap-2" disabled={locked}>
          <legend className="mb-1 text-body-sm font-medium text-ink">{t("classes")}</legend>
          <p className="text-caption text-ink-muted">{t("classesHint")}</p>
          {choices === null ? (
            <Skeleton lines={3} />
          ) : choices.length === 0 ? (
            <p className="text-body-sm text-ink-muted">{t("noClasses")}</p>
          ) : (
            <div className="grid gap-1 sm:grid-cols-2">
              {choices.map((choice) => (
                <Checkbox
                  key={choice.offering_id}
                  label={`${choice.section_label} · ${choice.subject.name}`}
                  checked={offeringIds.includes(choice.offering_id)}
                  // One subject per homework: other subjects are greyed out once one is picked.
                  disabled={locked || (subjectId !== null && choice.subject.id !== subjectId)}
                  onChange={(event) => toggleOffering(choice.offering_id, event.target.checked)}
                />
              ))}
            </div>
          )}
          {offeringIds.length > 0 ? (
            <Checkbox
              label={t("someStudents")}
              hint={t("someStudentsHint")}
              checked={someStudents}
              onChange={(event) => {
                setSomeStudents(event.target.checked);
                setStudentIds([]);
              }}
            />
          ) : null}
          {someStudents && roster.length > 0 ? (
            <div className="grid max-h-56 gap-1 overflow-y-auto rounded-input border border-border p-2 sm:grid-cols-2">
              {roster.map((student) => (
                <Checkbox
                  key={student.student_id}
                  label={student.roll_no ? `${student.roll_no}. ${student.full_name}` : student.full_name}
                  checked={studentIds.includes(student.student_id)}
                  onChange={(event) =>
                    setStudentIds((current) => (event.target.checked ? [...current, student.student_id] : current.filter((id) => id !== student.student_id)))
                  }
                />
              ))}
            </div>
          ) : null}
        </fieldset>

        <div className="flex flex-col gap-1.5">
          <span className="text-body-sm font-medium text-ink">{t("instructions")}</span>
          <RichTextEditor value={html} onChange={setHtml} variant="lite" placeholder={t("instructionsPlaceholder")} minHeightClassName="min-h-[120px]" />
        </div>

        <RadioGroup
          legend={t("type")}
          name="homework-type"
          inline
          value={type}
          onChange={(value) => setType(value as HomeworkType)}
          options={TYPES.map((value) => ({ value, label: t(`types.${value}`), hint: t(`typeHints.${value}`), disabled: locked }))}
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <Input label={t("marks")} type="number" inputMode="decimal" min={0.5} max={1000} step={0.5} value={marks} hint={t("marksHint")} onChange={(event) => setMarks(event.target.value)} />
          <DatePicker label={t("dueDate")} value={dueDate} onChange={setDueDate} hint={t("dueHint")} />
          <TimePicker label={t("dueTime")} value={dueTime} onChange={setDueTime} disabled={!dueDate} />
        </div>

        <FileDrop
          label={t("attachments")}
          onFiles={addFiles}
          items={attachments}
          onRemove={(id) => setAttachments((current) => current.filter((item) => item.id !== id))}
          accept="image/*,.pdf,.doc,.docx,.txt"
          acceptLabel={t("attachmentsAccept")}
          maxSizeMb={20}
          multiple
        />
      </div>
    </Drawer>
  );
};

export default HomeworkEditor;
