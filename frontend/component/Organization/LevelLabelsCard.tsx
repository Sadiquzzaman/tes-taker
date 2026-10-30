"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { Button, Card, ErrorState, Input, RadioGroup, Skeleton } from "@/design/ui";
import useAcademicsRequest from "@/hooks/academics/useAcademicsRequest";
import {
  LEVEL_LABEL_MAX_LENGTH,
  LEVEL_LABEL_PRESETS,
  LEVELS,
  toLevelLabels,
  writeLevelLabelsCookie,
  type Level,
  type LevelLabelPreset,
  type LevelLabels,
  type LevelName,
} from "@/i18n/levelLabels";
import axiosReq from "@/lib/axios";

const PRESETS: LevelLabelPreset[] = ["CLASS_SECTION", "COURSE_BATCH", "CUSTOM"];

const EMPTY_NAME: LevelName = { en: { one: "", other: "" }, bn: "" };

const isFilled = (name: LevelName) =>
  [name.en.one, name.en.other, name.bn].every((value) => value.trim() !== "" && value.trim().length <= LEVEL_LABEL_MAX_LENGTH);

/**
 * The owner names the workspace's two levels (FND-03): Class / Section, Course / Batch or their own
 * words in English and Bangla. Saving re-renders the app with the new names.
 */
const LevelLabelsCard = () => {
  const t = useTranslations("levelLabels");
  const router = useRouter();
  const { baseUrl, run } = useAcademicsRequest();
  const [, startTransition] = useTransition();
  const [saved, setSaved] = useState<LevelLabels | null>(null);
  const [failed, setFailed] = useState(false);
  const [preset, setPreset] = useState<LevelLabelPreset>("CLASS_SECTION");
  const [custom, setCustom] = useState<Record<Level, LevelName>>({ class: EMPTY_NAME, section: EMPTY_NAME });
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);

  const show = useCallback((labels: LevelLabels) => {
    setSaved(labels);
    setPreset(labels.preset);
    if (labels.preset === "CUSTOM") setCustom({ class: labels.class, section: labels.section });
  }, []);

  const fetchLabels = useCallback(
    () => run(async () => (await axiosReq.get<ApiResponse<LevelLabels>>(`${baseUrl}/workspace/level-labels`)).data?.payload ?? null),
    [baseUrl, run],
  );

  const apply = useCallback(
    (payload: LevelLabels | null) => {
      if (payload) show(toLevelLabels(payload));
      else setFailed(true);
    },
    [show],
  );

  useEffect(() => {
    void fetchLabels().then(apply);
  }, [apply, fetchLabels]);

  const draft: LevelLabels = preset === "CUSTOM" ? { preset, ...custom } : LEVEL_LABEL_PRESETS[preset];
  const customValid = isFilled(custom.class) && isFilled(custom.section);

  const setName = (level: Level, change: (name: LevelName) => LevelName) =>
    setCustom((current) => ({ ...current, [level]: change(current[level]) }));

  const save = async () => {
    if (preset === "CUSTOM" && !customValid) {
      setShowErrors(true);
      return;
    }
    setSaving(true);
    const body = preset === "CUSTOM" ? draft : { preset };
    const payload = await run(
      async () => (await axiosReq.patch<ApiResponse<LevelLabels>>(`${baseUrl}/workspace/level-labels`, body)).data?.payload,
      t("saved"),
    );
    setSaving(false);
    if (!payload) return;
    const labels = toLevelLabels(payload);
    show(labels);
    setShowErrors(false);
    if (writeLevelLabelsCookie(labels)) startTransition(() => router.refresh());
  };

  if (failed) {
    return (
      <Card title={t("title")}>
        <ErrorState
          title={t("loadFailed")}
          onRetry={() => {
            setFailed(false);
            void fetchLabels().then(apply);
          }}
        />
      </Card>
    );
  }

  if (!saved) {
    return (
      <Card title={t("title")} aria-busy="true">
        <Skeleton lines={4} />
      </Card>
    );
  }

  const fieldError = (value: string) =>
    showErrors && (value.trim() === "" || value.trim().length > LEVEL_LABEL_MAX_LENGTH) ? t("required", { max: LEVEL_LABEL_MAX_LENGTH }) : undefined;

  return (
    <Card
      title={t("title")}
      description={t("intro")}
      footer={
        <div className="flex justify-end">
          <Button onClick={() => void save()} loading={saving}>
            {t("save")}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        <RadioGroup
          legend={t("choice")}
          name="level-labels-preset"
          value={preset}
          onChange={(value) => setPreset(value as LevelLabelPreset)}
          options={PRESETS.map((value) => ({ value, label: t(`presets.${value}`), hint: t(`presetHints.${value}`) }))}
        />

        {preset === "CUSTOM"
          ? LEVELS.map((level) => (
              <fieldset key={level} className="flex flex-col gap-3">
                <legend className="mb-1 text-body-sm font-medium text-ink">{t(level === "class" ? "classLevel" : "sectionLevel")}</legend>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Input
                    label={t("one")}
                    value={custom[level].en.one}
                    maxLength={LEVEL_LABEL_MAX_LENGTH}
                    error={fieldError(custom[level].en.one)}
                    onChange={(event) => setName(level, (name) => ({ ...name, en: { ...name.en, one: event.target.value } }))}
                  />
                  <Input
                    label={t("other")}
                    value={custom[level].en.other}
                    maxLength={LEVEL_LABEL_MAX_LENGTH}
                    error={fieldError(custom[level].en.other)}
                    onChange={(event) => setName(level, (name) => ({ ...name, en: { ...name.en, other: event.target.value } }))}
                  />
                  <Input
                    label={t("bn")}
                    lang="bn"
                    value={custom[level].bn}
                    maxLength={LEVEL_LABEL_MAX_LENGTH}
                    error={fieldError(custom[level].bn)}
                    onChange={(event) => setName(level, (name) => ({ ...name, bn: event.target.value }))}
                  />
                </div>
              </fieldset>
            ))
          : null}

        <div className="flex flex-col gap-2 rounded-card bg-canvas p-4" aria-live="polite">
          <p className="text-body-sm font-medium text-ink">{t("preview")}</p>
          {LEVELS.map((level) => (
            <p key={level} className="text-body-sm text-ink-muted">
              {t("previewEnglish", { one: draft[level].en.one || "—", other: draft[level].en.other || "—" })} ·{" "}
              <span lang="bn">{t("previewBangla", { name: draft[level].bn || "—" })}</span>
            </p>
          ))}
        </div>
      </div>
    </Card>
  );
};

export default LevelLabelsCard;
