"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import useApiData from "@/component/Homework/useApiData";
import { Button, CloseIcon, Drawer, IconButton, Input, Skeleton } from "@/design/ui";
import { useApiError } from "@/hooks/api/useApiError";
import axiosReq from "@/lib/axios";

const MAX_CRITERIA = 10;

type Row = { id?: string; name_en: string; name_bn: string };

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: (criteria: BehaviourCriterion[]) => void;
}

/**
 * The organisation's behaviour criteria (PRF-04), in both languages, in order. A criterion taken
 * off the list is retired: its past ratings still count for the terms they were given in.
 */
const CriteriaDrawer = ({ open, onClose, onSaved }: Props) => {
  const t = useTranslations("behaviour");
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const { handleError } = useApiError();
  const { data: criteria, reload } = useApiData<BehaviourCriterion[]>("/behaviour/criteria");
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) reload();
  }, [open, reload]);

  useEffect(() => {
    if (!open || !criteria) return;
    setRows(criteria.map(({ id, name_en, name_bn }) => ({ id, name_en, name_bn })));
    setError(null);
  }, [open, criteria]);

  const save = async () => {
    const trimmed = rows.map((row) => ({ ...row, name_en: row.name_en.trim(), name_bn: row.name_bn.trim() }));
    if (trimmed.length === 0 || trimmed.some((row) => !row.name_en || !row.name_bn)) return setError(t("errors.RESULTS_CRITERIA_INVALID"));
    setError(null);
    setSaving(true);
    try {
      const response = await axiosReq.put<ApiResponse<BehaviourCriterion[]>>(`${baseUrl}/behaviour/criteria`, { criteria: trimmed });
      onSaved(response.data.payload);
    } catch (err) {
      const code = (err as AxiosError<ApiError & { code?: string }>).response?.data?.code;
      if (code?.startsWith("RESULTS_")) setError(t(`errors.${code}` as never));
      else handleError(err as AxiosError<ApiError>);
    } finally {
      setSaving(false);
    }
  };

  const setRow = (index: number, change: Partial<Row>) => setRows((current) => current.map((row, i) => (i === index ? { ...row, ...change } : row)));

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={t("criteriaTitle")}
      description={t("criteriaIntro")}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button loading={saving} onClick={() => void save()}>
            {t("saveCriteria")}
          </Button>
        </div>
      }
    >
      {criteria === null ? (
        <Skeleton lines={4} />
      ) : (
        <div className="flex flex-col gap-4">
          {rows.map((row, index) => (
            <fieldset key={row.id ?? `new-${index}`} className="flex items-end gap-2">
              <legend className="sr-only">{t("criterionNumber", { number: index + 1 })}</legend>
              <Input label={t("nameEn", { number: index + 1 })} fieldClassName="flex-1" maxLength={80} value={row.name_en} onChange={(event) => setRow(index, { name_en: event.target.value })} />
              <Input label={t("nameBn", { number: index + 1 })} fieldClassName="flex-1" maxLength={80} value={row.name_bn} onChange={(event) => setRow(index, { name_bn: event.target.value })} />
              <IconButton
                label={t("removeCriterion", { number: index + 1 })}
                icon={<CloseIcon />}
                disabled={rows.length === 1}
                onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
              />
            </fieldset>
          ))}
          {rows.length < MAX_CRITERIA ? (
            <Button size="sm" variant="ghost" className="self-start" onClick={() => setRows((current) => [...current, { name_en: "", name_bn: "" }])}>
              {t("addCriterion")}
            </Button>
          ) : null}
          <p className="text-body-sm text-ink-muted">{t("retireHint")}</p>
          {error ? (
            <p role="alert" className="text-body-sm text-danger">
              {error}
            </p>
          ) : null}
        </div>
      )}
    </Drawer>
  );
};

export default CriteriaDrawer;
