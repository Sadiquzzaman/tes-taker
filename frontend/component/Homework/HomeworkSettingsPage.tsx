"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useToast } from "@/component/Toast/ToastContext";
import { Button, Card, Checkbox, ErrorState, Input, PageHeader, Select, Skeleton } from "@/design/ui";
import { useApiError } from "@/hooks/api/useApiError";
import useBillingAccess from "@/hooks/organization/useBillingAccess";
import useFormat from "@/i18n/useFormat";
import axiosReq from "@/lib/axios";
import useApiData from "./useApiData";

/**
 * The organisation's homework settings (Epic 2 settings table): late work, the late penalty, how
 * often a student may hand in again, and files per hand-in. Owners and admins change them (a solo
 * teacher in their own workspace); other staff see them read-only.
 */
const HomeworkSettingsPage = () => {
  const t = useTranslations("homework.settings");
  const format = useFormat();
  const { triggerToast } = useToast();
  const { handleError } = useApiError();
  const { canManageBilling: canEdit } = useBillingAccess();
  const { data, failed, reload, setData } = useApiData<HomeworkSettings>("/homework/settings");
  const [draft, setDraft] = useState<HomeworkSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const value = draft ?? data;

  if (failed !== null) return <ErrorState title={t("loadFailed")} onRetry={reload} />;
  if (!value) {
    return (
      <Card aria-busy="true">
        <Skeleton lines={5} />
      </Card>
    );
  }

  const change = (next: Partial<HomeworkSettings>) => setDraft({ ...value, ...next });
  const penaltyInvalid = value.late_penalty.type !== "NONE" && !(value.late_penalty.percent >= 1 && value.late_penalty.percent <= 100);

  const save = async () => {
    setSaving(true);
    try {
      const res = await axiosReq.patch<{ payload: HomeworkSettings }>(`${process.env.NEXT_PUBLIC_BASE_URL}/homework/settings`, value);
      setData(res.data.payload);
      setDraft(null);
      triggerToast({ title: t("savedTitle"), description: t("saved"), type: "success" });
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 pb-8">
      <PageHeader title={t("title")} description={canEdit ? t("intro") : t("readOnly")} />
      <Card>
        <fieldset className="flex flex-col gap-5" disabled={!canEdit}>
          <Checkbox label={t("lateAllowed")} hint={t("lateAllowedHint")} checked={value.late_allowed} onChange={(event) => change({ late_allowed: event.target.checked })} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label={t("penalty")}
              placeholder={false}
              value={value.late_penalty.type}
              onChange={(event) => change({ late_penalty: { type: event.target.value as HomeworkSettings["late_penalty"]["type"], percent: value.late_penalty.percent || 10 } })}
              options={(["NONE", "PER_DAY", "FIXED"] as const).map((type) => ({ value: type, label: t(`penalties.${type}`) }))}
            />
            {value.late_penalty.type !== "NONE" ? (
              <Input
                label={t("percent")}
                type="number"
                min={1}
                max={100}
                value={String(value.late_penalty.percent)}
                error={penaltyInvalid ? t("percentInvalid") : undefined}
                onChange={(event) => change({ late_penalty: { ...value.late_penalty, percent: Number(event.target.value) } })}
              />
            ) : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label={t("resubmissions")}
              hint={t("resubmissionsHint")}
              placeholder={false}
              value={String(value.resubmissions)}
              onChange={(event) => change({ resubmissions: Number(event.target.value) })}
              options={[0, 1, 2, 3].map((n) => ({ value: String(n), label: n === 0 ? t("noResubmission") : format.number(n) }))}
            />
            <Select
              label={t("maxFiles")}
              hint={t("maxFilesHint")}
              placeholder={false}
              value={String(value.max_files)}
              onChange={(event) => change({ max_files: Number(event.target.value) })}
              options={Array.from({ length: 10 }, (_, i) => i + 1).map((n) => ({ value: String(n), label: format.number(n) }))}
            />
          </div>
          {/* The two numbers above in one plain sentence, as students will live them. */}
          <p className="rounded-input bg-canvas px-3 py-2 text-body-sm text-ink" aria-live="polite">
            {t("summary", { changes: value.resubmissions, files: value.max_files })}
          </p>
        </fieldset>
      </Card>
      {canEdit ? (
        <div className="flex justify-end gap-2">
          <Button variant="secondary" disabled={!draft || saving} onClick={() => setDraft(null)}>
            {t("undo")}
          </Button>
          <Button loading={saving} disabled={!draft || saving || penaltyInvalid} onClick={() => void save()}>
            {t("save")}
          </Button>
        </div>
      ) : null}
    </div>
  );
};

export default HomeworkSettingsPage;
