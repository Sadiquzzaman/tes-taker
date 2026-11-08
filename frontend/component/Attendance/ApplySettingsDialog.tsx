"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button, Modal, RadioGroup, Skeleton } from "@/design/ui";
import axiosReq from "@/lib/axios";

type Target = "class" | "shift";

interface ApplySettingsDialogProps {
  baseUrl: string | undefined;
  source: SectionSetup | null;
  sectionName: (section: SectionSetup) => string;
  onClose: () => void;
  onApplied: (count: number) => void;
  onError: (error: AxiosError<ApiError>) => void;
}

/**
 * Applies one section's settings — in person or online, the attendance method and "Late after" —
 * to every other section of its class or its shift, after a preview. Never the branch, and never
 * the periods: the timetable is copied in the Routine.
 */
const ApplySettingsDialog = ({ baseUrl, source, sectionName, onClose, onApplied, onError }: ApplySettingsDialogProps) => {
  const t = useTranslations("classSetup");
  const [target, setTarget] = useState<Target>("class");
  const [preview, setPreview] = useState<ApplyScheduleResult | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTarget("class");
  }, [source]);

  const body = (dryRun: boolean) =>
    source
      ? {
          from_section_id: source.id,
          ...(target === "class" ? { class_id: source.class.id } : { shift: source.shift }),
          include_schedule: false,
          include_settings: true,
          dry_run: dryRun,
        }
      : null;

  useEffect(() => {
    if (!source) return;
    let cancelled = false;
    setPreview(null);
    axiosReq
      .post<ApiResponse<ApplyScheduleResult>>(`${baseUrl}/attendance/setup/apply`, body(true))
      .then((response) => {
        if (!cancelled) setPreview(response.data?.payload ?? null);
      })
      .catch((error) => {
        if (!cancelled) onError(error as AxiosError<ApiError>);
      });
    return () => {
      cancelled = true;
    };
    // The preview depends only on the source and the target.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, target, baseUrl]);

  const apply = async () => {
    setSaving(true);
    try {
      await axiosReq.post(`${baseUrl}/attendance/setup/apply`, body(false));
      onApplied(preview?.sections.length ?? 0);
    } catch (error) {
      onError(error as AxiosError<ApiError>);
    } finally {
      setSaving(false);
    }
  };

  const count = preview?.sections.length ?? 0;

  return (
    <Modal
      open={source !== null}
      onClose={onClose}
      title={t("applySettingsTitle")}
      description={source ? t("applySettingsIntro", { section: sectionName(source) }) : undefined}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            {t("cancel")}
          </Button>
          <Button onClick={() => void apply()} loading={saving} disabled={!preview || count === 0}>
            {t("applySettingsConfirm", { count })}
          </Button>
        </div>
      }
    >
      {source ? (
        <div className="flex flex-col gap-4">
          <RadioGroup
            legend={t("applyTo")}
            name="apply-target"
            value={target}
            onChange={(value) => setTarget(value as Target)}
            options={[
              { value: "class", label: t("applyToClass", { class: source.class.name }) },
              ...(source.shift ? [{ value: "shift", label: t("applyToShift", { shift: t(`shift.${source.shift}`) }) }] : []),
            ]}
          />
          {!preview ? (
            <div aria-busy="true">
              <Skeleton lines={3} />
            </div>
          ) : count === 0 ? (
            <p className="text-body-sm text-ink-muted">{t("applyNone")}</p>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-body-sm font-medium text-ink">{t("applySettingsWill", { count })}</p>
              <ul className="flex flex-col gap-1 text-body-sm">
                {preview.sections.map((section) => (
                  <li key={section.id} className="text-ink">{`${section.class_name} ${section.name}`}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : null}
    </Modal>
  );
};

export default ApplySettingsDialog;
