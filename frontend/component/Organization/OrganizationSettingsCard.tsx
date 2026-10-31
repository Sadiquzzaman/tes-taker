"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/component/Toast/ToastContext";
import { Card, Select, Skeleton, Switch } from "@/design/ui";
import { useApiError } from "@/hooks/api/useApiError";
import axiosReq from "@/lib/axios";

const LANGUAGES: OrganizationLocale[] = ["bn", "en"];

/**
 * Organisation settings (owners and admins): whether sections have a class teacher (FND-02), the
 * language for members who have not chosen one (FND-18) and the guardian SMS language (FND-10).
 */
const OrganizationSettingsCard = ({ organizationId }: { organizationId: string }) => {
  const t = useTranslations("academics.settings");
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const { handleError } = useApiError();
  const { triggerToast } = useToast();
  const [settings, setSettings] = useState<OrganizationSettings | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await axiosReq.get<ApiResponse<OrganizationSettings>>(`${baseUrl}/organizations/${organizationId}/settings`);
      setSettings(res.data?.payload ?? null);
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    }
  }, [baseUrl, handleError, organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const update = async (change: Partial<Pick<OrganizationSettings, "class_teacher_enabled" | "default_locale" | "sms_locale">>) => {
    setSaving(true);
    try {
      const res = await axiosReq.patch<ApiResponse<OrganizationSettings>>(`${baseUrl}/organizations/${organizationId}/settings`, change);
      setSettings(res.data?.payload ?? null);
      triggerToast({ title: t("saved"), type: "success" });
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title={t("title")}>
      {settings ? (
        <div className="flex flex-col gap-6">
          <Switch
            label={t("classTeacher")}
            hint={t("classTeacherHint")}
            checked={settings.class_teacher_enabled}
            disabled={saving}
            onChange={(checked) => void update({ class_teacher_enabled: checked })}
          />
          <Select
            label={t("language")}
            hint={t("languageHint")}
            value={settings.default_locale}
            disabled={saving}
            placeholder={false}
            options={LANGUAGES.map((value) => ({ value, label: t(`languages.${value}`) }))}
            onChange={(event) => void update({ default_locale: event.target.value as OrganizationLocale })}
            fieldClassName="sm:max-w-xs"
          />
          <Select
            label={t("smsLanguage")}
            hint={t("smsLanguageHint")}
            value={settings.sms_locale}
            disabled={saving}
            placeholder={false}
            options={LANGUAGES.map((value) => ({ value, label: t(`languages.${value}`) }))}
            onChange={(event) => void update({ sms_locale: event.target.value as OrganizationLocale })}
            fieldClassName="sm:max-w-xs"
          />
        </div>
      ) : (
        <Skeleton lines={2} />
      )}
    </Card>
  );
};

export default OrganizationSettingsCard;
