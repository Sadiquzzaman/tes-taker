"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button, Checkbox, CloseIcon, DatePicker, Drawer, IconButton, Input, Select, Skeleton } from "@/design/ui";
import { useApiError } from "@/hooks/api/useApiError";
import axiosReq from "@/lib/axios";
import useApiData from "@/component/Homework/useApiData";
import { todayInSchool } from "@/utils/schoolDate";

/** The API's error codes the form explains itself (messages `marks.errors`). */
const FORM_ERRORS = ["OFFLINE_EXAM_PARTS_INVALID", "OFFLINE_EXAM_TERM_INVALID", "OFFLINE_EXAM_TOTAL_BELOW_MARKS", "OFFLINE_EXAM_SESSION_CLOSED", "OFFLINE_EXAM_NOT_ALLOWED"] as const;
type FormError = (typeof FORM_ERRORS)[number] | "CLASS_REQUIRED" | "NAME_REQUIRED" | "TOTAL_REQUIRED";

const MAX_PARTS = 6;

interface Props {
  open: boolean;
  /** null: a new paper exam. */
  exam: PaperExam | null;
  onClose: () => void;
  onSaved: (exam: PaperExam) => void;
}

/**
 * Adds or changes a paper exam (PRF-03): the subject class, a name, the date, the total and,
 * optionally, its parts (e.g. MCQ 30 + Written 70; they must add up to the total) and a term.
 */
const PaperExamDrawer = ({ open, exam, onClose, onSaved }: Props) => {
  const t = useTranslations("marks");
  const tErrors = useTranslations("marks.errors");
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const { handleError } = useApiError();
  const { data: classes } = useApiData<PaperSubjectClass[]>("/offline-exams/subject-classes");
  const [offeringId, setOfferingId] = useState("");
  const [name, setName] = useState("");
  const [date, setDate] = useState(todayInSchool());
  const [total, setTotal] = useState("100");
  const [withParts, setWithParts] = useState(false);
  const [parts, setParts] = useState<{ name: string; marks: string }[]>([]);
  const [termId, setTermId] = useState("");
  const [error, setError] = useState<FormError | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setOfferingId(exam?.offering.id ?? "");
    setName(exam?.name ?? "");
    setDate(exam?.exam_date ?? todayInSchool());
    setTotal(String(exam?.total_marks ?? 100));
    setWithParts(Boolean(exam?.parts?.length));
    setParts(exam?.parts?.map((part) => ({ name: part.name, marks: String(part.marks) })) ?? []);
    setTermId(exam?.term?.id ?? "");
    setError(null);
  }, [open, exam]);

  const chosen = classes?.find((item) => item.offering_id === offeringId);
  const partsSum = parts.reduce((sum, part) => sum + (Number(part.marks) || 0), 0);

  const toggleParts = (on: boolean) => {
    setWithParts(on);
    if (on && parts.length === 0) setParts([{ name: t("partMcq"), marks: "" }, { name: t("partWritten"), marks: "" }]);
  };

  const save = async () => {
    if (!exam && !offeringId) return setError("CLASS_REQUIRED");
    if (!name.trim()) return setError("NAME_REQUIRED");
    if (!(Number(total) > 0)) return setError("TOTAL_REQUIRED");
    setError(null);
    setSaving(true);
    const body = {
      name: name.trim(),
      exam_date: date,
      total_marks: Number(total),
      parts: withParts ? parts.map((part) => ({ name: part.name.trim(), marks: Number(part.marks) })) : null,
      term_id: termId || null,
    };
    try {
      const response = exam
        ? await axiosReq.patch<ApiResponse<PaperExam>>(`${baseUrl}/offline-exams/${exam.id}`, body)
        : await axiosReq.post<ApiResponse<PaperExam>>(`${baseUrl}/offline-exams`, { ...body, offering_id: offeringId });
      onSaved(response.data.payload);
    } catch (err) {
      const code = (err as AxiosError<ApiError & { code?: string }>).response?.data?.code;
      if (code && (FORM_ERRORS as readonly string[]).includes(code)) setError(code as FormError);
      else handleError(err as AxiosError<ApiError>);
    } finally {
      setSaving(false);
    }
  };

  const terms = exam ? (classes?.find((item) => item.offering_id === exam.offering.id)?.terms ?? (exam.term ? [{ ...exam.term, start_date: null, end_date: null }] : [])) : (chosen?.terms ?? []);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={exam ? t("editTitle") : t("addTitle")}
      description={t("formIntro")}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button loading={saving} onClick={() => void save()}>
            {t("save")}
          </Button>
        </div>
      }
    >
      {classes === null && !exam ? (
        <Skeleton lines={4} />
      ) : (
        <div className="flex flex-col gap-4">
          {exam ? (
            <p className="text-body-sm text-ink">{`${exam.offering.subject.name} · ${exam.offering.section.class_name ?? ""} ${exam.offering.section.name}`.trim()}</p>
          ) : (
            <Select
              label={t("subjectClass")}
              placeholder={t("chooseSubjectClass")}
              value={offeringId}
              onChange={(event) => {
                setOfferingId(event.target.value);
                setTermId("");
              }}
              options={(classes ?? []).map((item) => ({ value: item.offering_id, label: `${item.subject.name} · ${item.section_label}` }))}
              hint={classes && classes.length === 0 ? t("noSubjectClasses") : undefined}
            />
          )}
          <Input label={t("name")} value={name} maxLength={120} placeholder={t("namePlaceholder")} onChange={(event) => setName(event.target.value)} />
          <div className="grid gap-4 sm:grid-cols-2">
            <DatePicker label={t("date")} value={date} onChange={setDate} />
            <Input label={t("total")} type="number" min={1} max={1000} value={total} onChange={(event) => setTotal(event.target.value)} />
          </div>
          {terms.length ? (
            <Select label={t("term")} placeholder={t("noTerm")} value={termId} onChange={(event) => setTermId(event.target.value)} options={terms.map((term) => ({ value: term.id, label: term.name }))} />
          ) : null}
          <Checkbox label={t("withParts")} hint={t("withPartsHint")} checked={withParts} onChange={(event) => toggleParts(event.target.checked)} />
          {withParts ? (
            <fieldset className="flex flex-col gap-2">
              <legend className="sr-only">{t("parts")}</legend>
              {parts.map((part, index) => (
                <div key={index} className="flex items-end gap-2">
                  <Input
                    label={t("partName", { number: index + 1 })}
                    fieldClassName="flex-1"
                    value={part.name}
                    maxLength={40}
                    onChange={(event) => setParts((current) => current.map((p, i) => (i === index ? { ...p, name: event.target.value } : p)))}
                  />
                  <Input
                    label={t("partMarks", { number: index + 1 })}
                    fieldClassName="w-28"
                    type="number"
                    min={0}
                    value={part.marks}
                    onChange={(event) => setParts((current) => current.map((p, i) => (i === index ? { ...p, marks: event.target.value } : p)))}
                  />
                  <IconButton label={t("removePart", { number: index + 1 })} icon={<CloseIcon />} onClick={() => setParts((current) => current.filter((_, i) => i !== index))} />
                </div>
              ))}
              {parts.length < MAX_PARTS ? (
                <Button size="sm" variant="ghost" className="self-start" onClick={() => setParts((current) => [...current, { name: "", marks: "" }])}>
                  {t("addPart")}
                </Button>
              ) : null}
              <p className={partsSum === Number(total) ? "text-body-sm text-ink-muted" : "text-body-sm text-danger"}>{t("partsSum", { sum: partsSum, total: Number(total) || 0 })}</p>
            </fieldset>
          ) : null}
          {error ? (
            <p role="alert" className="text-body-sm text-danger">
              {tErrors(error)}
            </p>
          ) : null}
        </div>
      )}
    </Drawer>
  );
};

export default PaperExamDrawer;
