"use client";

import { useTranslations } from "next-intl";
import useApiData from "@/component/Homework/useApiData";
import useFeatureNames from "@/component/Subscription/useFeatureNames";
import { Card, Checkbox, Input, RadioGroup, Skeleton } from "@/design/ui";

const DEFAULT_THRESHOLD = 15;
const DEFAULT_ALERT_FLAGS = 5;
/** Checks that need the camera or microphone (the rest run in the browser). */
export const CAMERA_CHECKS = ["proctoring_no_face", "proctoring_multiple_face", "proctoring_looking_away", "proctoring_phone", "proctoring_voice"];

/** The choice to show: the saved one, or the plan's best level with auto-disqualify off. */
export const proctoringChoice = (value: ExamProctoringChoice | null | undefined, options: ProctoringOptions): ExamProctoringChoice =>
  value ?? { level: options.default_level, checks_off: [], auto_disqualify: false, disqualify_threshold: DEFAULT_THRESHOLD, disqualify_checks: null, alert_flags: null };

/**
 * Proctoring for one exam (P8-01, PRO-01, PRO-02): Off, Light (browser checks) or Strict (plus
 * camera, microphone and phone), as far as the plan allows; single checks can be switched off;
 * auto-disqualification is off unless turned on, with the number of flags and which checks count.
 */
const ProctoringSettingsCard = ({ value, onChange }: { value: ExamProctoringChoice | null | undefined; onChange: (next: ExamProctoringChoice) => void }) => {
  const t = useTranslations("createTest.proctoring");
  const { featureName } = useFeatureNames();
  const { data: options } = useApiData<ProctoringOptions>("/exams/proctoring-options");

  if (!options) {
    return (
      <Card title={t("title")} aria-busy="true">
        <Skeleton lines={3} />
      </Card>
    );
  }
  const choice = proctoringChoice(value, options);
  const level = options.levels.find((l) => l.level === choice.level) ?? options.levels[0];
  const active = level.checks.filter((check) => !choice.checks_off.includes(check));
  const counted = choice.disqualify_checks ?? active;
  const set = (next: Partial<ExamProctoringChoice>) => onChange({ ...choice, ...next });
  const threshold = choice.disqualify_threshold;

  return (
    <Card title={t("title")} description={t("intro")}>
      <div className="flex flex-col gap-5">
        <RadioGroup
          legend={t("level")}
          name="proctoring-level"
          value={choice.level}
          onChange={(next) => set({ level: next as ProctoringLevel, checks_off: [], disqualify_checks: null })}
          options={options.levels.map((l) => ({
            value: l.level,
            label: t(`levels.${l.level}`),
            hint: l.available ? t(`levelHints.${l.level}`) : t("notOnPlan"),
            disabled: !l.available,
          }))}
        />
        {level.checks.length ? (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-body-sm font-medium text-ink">{t("checks")}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {level.checks.map((check) => (
                <Checkbox
                  key={check}
                  label={featureName(check)}
                  checked={!choice.checks_off.includes(check)}
                  onChange={(event) =>
                    set({
                      checks_off: event.target.checked ? choice.checks_off.filter((c) => c !== check) : [...choice.checks_off, check],
                      disqualify_checks: choice.disqualify_checks?.filter((c) => c !== check || event.target.checked) ?? null,
                    })
                  }
                />
              ))}
            </div>
          </fieldset>
        ) : null}
        {active.length ? (
          <div className="flex flex-col gap-3 rounded-card border border-border bg-canvas p-4">
            <Checkbox
              label={t("autoDisqualify")}
              hint={options.auto_disqualify_available ? t("autoDisqualifyHint") : t("autoDisqualifyNotOnPlan")}
              disabled={!options.auto_disqualify_available}
              checked={choice.auto_disqualify && options.auto_disqualify_available}
              onChange={(event) => set({ auto_disqualify: event.target.checked })}
            />
            {choice.auto_disqualify && options.auto_disqualify_available ? (
              <>
                <Input
                  label={t("threshold")}
                  fieldClassName="sm:w-48"
                  type="number"
                  min={1}
                  max={100}
                  value={String(threshold)}
                  error={threshold >= 1 && threshold <= 100 ? undefined : t("thresholdInvalid")}
                  hint={t("warnAt", { count: Math.max(1, Math.ceil(threshold * 0.6)) })}
                  onChange={(event) => set({ disqualify_threshold: Math.round(Number(event.target.value)) })}
                />
                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-1 text-body-sm font-medium text-ink">{t("counted")}</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {active.map((check) => (
                      <Checkbox
                        key={check}
                        label={featureName(check)}
                        checked={counted.includes(check)}
                        onChange={(event) => {
                          const next = event.target.checked ? [...counted, check] : counted.filter((c) => c !== check);
                          set({ disqualify_checks: next.length === active.length ? null : next });
                        }}
                      />
                    ))}
                  </div>
                  {counted.length === 0 ? <p className="text-body-sm text-danger">{t("countedNone")}</p> : null}
                </fieldset>
              </>
            ) : null}
          </div>
        ) : null}
        {active.length && options.alerts_available ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <Checkbox
              label={t("alerts")}
              hint={t("alertsHint")}
              checked={choice.alert_flags !== null && choice.alert_flags !== undefined}
              onChange={(event) => set({ alert_flags: event.target.checked ? DEFAULT_ALERT_FLAGS : null })}
            />
            {choice.alert_flags !== null && choice.alert_flags !== undefined ? (
              <Input
                label={t("alertAt")}
                fieldClassName="sm:w-48"
                type="number"
                min={1}
                max={100}
                value={String(choice.alert_flags)}
                error={choice.alert_flags >= 1 && choice.alert_flags <= 100 ? undefined : t("thresholdInvalid")}
                onChange={(event) => set({ alert_flags: Math.round(Number(event.target.value)) })}
              />
            ) : null}
          </div>
        ) : null}
        <p className="text-body-sm text-ink-muted" aria-live="polite">
          {choice.level === "OFF" || active.length === 0
            ? t("summaryOff")
            : t(active.some((c) => CAMERA_CHECKS.includes(c)) ? "summaryCamera" : "summaryBrowser", { count: active.length })}
        </p>
      </div>
    </Card>
  );
};

export default ProctoringSettingsCard;
