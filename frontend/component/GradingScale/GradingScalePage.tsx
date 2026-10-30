"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/component/Toast/ToastContext";
import { Badge, Button, Card, CloseIcon, ConfirmDialog, ErrorState, IconButton, Input, PageHeader, Skeleton, Table, type TableColumn } from "@/design/ui";
import useAcademicsRequest from "@/hooks/academics/useAcademicsRequest";
import { useApiError } from "@/hooks/api/useApiError";
import useFormat from "@/i18n/useFormat";
import axiosReq from "@/lib/axios";
import { isGradingScaleErrorCode, MAX_GRADE_BANDS, MAX_GRADE_LENGTH, validateGradeBands, type GradingScaleErrorCode } from "@/utils/gradingScale";

/** A band as typed: text, so a half-typed number is not lost. */
interface DraftBand {
  key: number;
  min: string;
  max: string;
  grade: string;
  gpa: string;
}

let nextKey = 0;
const toDraft = (band: GradeBand): DraftBand => ({
  key: ++nextKey,
  min: String(band.min_pct),
  max: String(band.max_pct),
  grade: band.grade,
  gpa: band.gpa === null ? "" : String(band.gpa),
});

const parse = (value: string) => (value.trim() === "" ? Number.NaN : Number(value));
const toBand = (draft: DraftBand): GradeBand => ({
  min_pct: parse(draft.min),
  max_pct: parse(draft.max),
  grade: draft.grade.trim(),
  gpa: draft.gpa.trim() === "" ? null : parse(draft.gpa),
});

/**
 * The workspace's grading scale (FND-11): percentage bands → grade and GPA, used on every mark.
 * Owners and admins (and a solo teacher) edit the bands or go back to the Bangladesh national
 * default; others see them read-only. Raw marks never change, only the grades shown.
 */
const GradingScalePage = () => {
  const t = useTranslations("gradingScale");
  const format = useFormat();
  // The same rule as sessions: owners and admins, or a solo teacher in their own workspace.
  const { baseUrl, run, canManageSessions: canEdit } = useAcademicsRequest();
  const { handleError } = useApiError();
  const { triggerToast } = useToast();
  const [scale, setScale] = useState<GradingScale | null>(null);
  const [failed, setFailed] = useState(false);
  const [name, setName] = useState("");
  const [bands, setBands] = useState<DraftBand[]>([]);
  const [problem, setProblem] = useState<{ code: GradingScaleErrorCode; band?: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const show = useCallback((next: GradingScale) => {
    setScale(next);
    setName(next.is_custom ? next.name : "");
    setBands(next.bands.map(toDraft));
    setProblem(null);
  }, []);

  const load = useCallback(async () => {
    setFailed(false);
    const payload = await run(async () => (await axiosReq.get<ApiResponse<GradingScale>>(`${baseUrl}/grading-scale`)).data?.payload ?? null);
    if (payload) show(payload);
    else setFailed(true);
  }, [baseUrl, run, show]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateBand = (key: number, change: Partial<DraftBand>) => {
    setBands((current) => current.map((band) => (band.key === key ? { ...band, ...change } : band)));
    setProblem(null);
  };

  const addBand = () => {
    setBands((current) => [...current, { key: ++nextKey, min: "", max: "", grade: "", gpa: "" }]);
    setProblem(null);
  };

  const removeBand = (key: number) => {
    setBands((current) => current.filter((band) => band.key !== key));
    setProblem(null);
  };

  const save = async () => {
    const parsed = bands.map(toBand);
    const found = validateGradeBands(parsed);
    if (found) {
      setProblem(found);
      return;
    }
    setSaving(true);
    try {
      const body = { ...(name.trim() ? { name: name.trim() } : {}), bands: parsed };
      const response = await axiosReq.put<ApiResponse<GradingScale>>(`${baseUrl}/grading-scale`, body);
      if (response.data?.payload) show(response.data.payload);
      triggerToast({ title: t("saved"), type: "success" });
    } catch (error) {
      const code = (error as AxiosError<ApiError>).response?.data?.code;
      if (isGradingScaleErrorCode(code)) setProblem({ code });
      else handleError(error as AxiosError<ApiError>);
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    setSaving(true);
    const payload = await run(async () => (await axiosReq.delete<ApiResponse<GradingScale>>(`${baseUrl}/grading-scale`)).data?.payload, t("resetDone"));
    setSaving(false);
    setConfirmReset(false);
    if (payload) show(payload);
  };

  const header = (
    <PageHeader
      title={t("title")}
      description={t("intro")}
      actions={scale ? <Badge tone={scale.is_custom ? "primary" : "neutral"}>{scale.is_custom ? scale.name : t("defaultName")}</Badge> : undefined}
    />
  );

  if (failed) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        {header}
        <Card>
          <ErrorState title={t("loadFailed")} onRetry={() => void load()} />
        </Card>
      </div>
    );
  }

  if (!scale) {
    return (
      <div className="flex flex-col gap-6 pb-8" aria-busy="true">
        {header}
        <Card>
          <Skeleton lines={7} />
        </Card>
      </div>
    );
  }

  const percent = (value: number) => format.number(value / 100, { style: "percent", maximumFractionDigits: 2 });
  const gpaText = (gpa: number | null) => (gpa === null ? "—" : format.number(gpa, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

  if (!canEdit) {
    const columns: TableColumn<GradeBand>[] = [
      { key: "from", header: t("from"), cell: (band) => percent(band.min_pct) },
      { key: "to", header: t("to"), cell: (band) => percent(band.max_pct) },
      { key: "grade", header: t("grade"), cell: (band) => <span className="font-medium text-ink">{band.grade}</span> },
      { key: "gpa", header: t("gpa"), cell: (band) => gpaText(band.gpa), align: "right" },
    ];
    return (
      <div className="flex flex-col gap-6 pb-8">
        {header}
        <Card title={t("bands")} description={t("readOnly")}>
          <Table caption={t("title")} columns={columns} rows={scale.bands} getRowId={(band) => band.grade} />
        </Card>
      </div>
    );
  }

  const rowError = (index: number) => (problem && problem.band === index ? t(`errors.${problem.code}`, { row: index + 1 }) : undefined);

  return (
    <div className="flex flex-col gap-6 pb-8">
      {header}
      <Card
        title={t("bands")}
        description={t("editHint")}
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3">
            {scale.is_custom ? (
              <Button variant="ghost" onClick={() => setConfirmReset(true)} disabled={saving}>
                {t("reset")}
              </Button>
            ) : (
              <span />
            )}
            <Button onClick={() => void save()} loading={saving}>
              {t("save")}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <Input label={t("name")} hint={t("nameHint")} value={name} maxLength={60} placeholder={t("customName")} onChange={(event) => setName(event.target.value)} />

          <ol className="flex flex-col gap-3" aria-label={t("bands")}>
            {bands.map((band, index) => (
              <li key={band.key} className="flex flex-col gap-2 rounded-card border border-border p-3" aria-invalid={problem?.band === index || undefined}>
                <div className="grid grid-cols-2 items-end gap-3 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]">
                  <Input
                    label={t("fromRow", { row: index + 1 })}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={100}
                    step={0.01}
                    trailing="%"
                    value={band.min}
                    onChange={(event) => updateBand(band.key, { min: event.target.value })}
                  />
                  <Input
                    label={t("toRow", { row: index + 1 })}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={100}
                    step={0.01}
                    trailing="%"
                    value={band.max}
                    onChange={(event) => updateBand(band.key, { max: event.target.value })}
                  />
                  <Input
                    label={t("gradeRow", { row: index + 1 })}
                    maxLength={MAX_GRADE_LENGTH}
                    value={band.grade}
                    onChange={(event) => updateBand(band.key, { grade: event.target.value })}
                  />
                  <Input
                    label={t("gpaRow", { row: index + 1 })}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={9.99}
                    step={0.01}
                    value={band.gpa}
                    onChange={(event) => updateBand(band.key, { gpa: event.target.value })}
                  />
                  <IconButton label={t("removeRow", { row: index + 1 })} icon={<CloseIcon />} onClick={() => removeBand(band.key)} disabled={bands.length <= 1} />
                </div>
                {rowError(index) ? (
                  <p role="alert" className="text-body-sm text-danger">
                    {rowError(index)}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>

          {problem && problem.band === undefined ? (
            <p role="alert" className="text-body-sm text-danger">
              {t(`errors.${problem.code}`, { row: 0 })}
            </p>
          ) : null}

          <div>
            <Button variant="secondary" onClick={addBand} disabled={bands.length >= MAX_GRADE_BANDS}>
              {t("addBand")}
            </Button>
          </div>
        </div>
      </Card>

      <ConfirmDialog
        open={confirmReset}
        title={t("resetTitle")}
        description={t("resetDescription")}
        confirmLabel={t("reset")}
        loading={saving}
        onConfirm={() => void reset()}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  );
};

export default GradingScalePage;
