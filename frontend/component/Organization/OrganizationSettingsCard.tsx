"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/component/Toast/ToastContext";
import { Card, Skeleton, Switch } from "@/design/ui";
import { useApiError } from "@/hooks/api/useApiError";
import axiosReq from "@/lib/axios";

/** Organisation settings (owners and admins): for now, whether sections have a class teacher (FND-02). */
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

  const toggle = async (classTeacherEnabled: boolean) => {
    setSaving(true);
    try {
      const res = await axiosReq.patch<ApiResponse<OrganizationSettings>>(`${baseUrl}/organizations/${organizationId}/settings`, {
        class_teacher_enabled: classTeacherEnabled,
      });
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
        <Switch
          label={t("classTeacher")}
          hint={t("classTeacherHint")}
          checked={settings.class_teacher_enabled}
          disabled={saving}
          onChange={(checked) => void toggle(checked)}
        />
      ) : (
        <Skeleton lines={2} />
      )}
    </Card>
  );
};

export default OrganizationSettingsCard;
