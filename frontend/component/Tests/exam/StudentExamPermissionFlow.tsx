"use client";

import RightArrowIconSVG from "@/component/svg/RightArrowIconSVG";
import SuccessIconSVG from "@/component/svg/SuccessIconSVG";
import useExamPermissions, { type ExamPermissionStatus } from "@/hooks/tests/proctoring/useExamPermissions";
import useFeatureNames from "@/component/Subscription/useFeatureNames";
import { markExamPermissionsComplete, setExamMediaStreams } from "@/utils/tests/examSessionMedia";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Checkbox, StatusPill, Stepper } from "@/design/ui";

type PermissionStep = "permissions" | "rules";

/** The rules shown for this exam's proctoring (P8-01): only those that apply. */
const rulesFor = (proctoring: EffectiveProctoring | null) => {
  const checks = proctoring?.checks ?? null;
  const camera = proctoring ? proctoring.camera : true;
  const rules: { key: string; values?: Record<string, number> }[] = [];
  if (camera) rules.push({ key: "media" });
  rules.push({ key: "read" });
  if (!checks || checks.includes("proctoring_tab_switch")) rules.push({ key: "tabs" });
  rules.push({ key: "time" });
  if (!checks || checks.length > 0) rules.push({ key: "flags" });
  if (!proctoring) rules.push({ key: "limit", values: { count: 15 } });
  else if (proctoring.auto_disqualify) {
    rules.push({ key: "warn", values: { count: proctoring.auto_disqualify.warn_at } });
    rules.push({ key: "limit", values: { count: proctoring.auto_disqualify.threshold } });
  } else if (proctoring.checks.length) rules.push({ key: "review" });
  return rules;
};

/**
 * Before the test: camera and microphone when the exam watches with them (Strict), then the
 * rules and what is watched (P8-01: "the student sees which checks are active before starting").
 * Off and Light exams go straight to the rules.
 */
const StudentExamPermissionFlow = ({ proctoring = null }: { proctoring?: EffectiveProctoring | null }) => {
  const router = useRouter();
  const t = useTranslations("exam.permissions");
  const { featureName } = useFeatureNames();
  const needsCamera = proctoring ? proctoring.camera : true;
  const [step, setStep] = useState<PermissionStep>(needsCamera ? "permissions" : "rules");
  const [rulesAccepted, setRulesAccepted] = useState(false);
  const { cameraStream, permissionState, errorMessage, allPermissionsGranted, requestCameraAndMicrophone } =
    useExamPermissions();

  const permissionCards = [
    { key: "camera", status: permissionState.camera, title: t("cameraTitle"), actionLabel: t("cameraAction") },
    {
      key: "microphone",
      status: permissionState.microphone,
      title: t("microphoneTitle"),
      actionLabel: t("microphoneAction"),
    },
  ];
  const statusLabel = (status: ExamPermissionStatus) =>
    status === "granted" || status === "denied" || status === "unsupported" ? t(`status.${status}`) : t("status.pending");

  const handleContinue = () => {
    if (!allPermissionsGranted) {
      return;
    }

    setStep("rules");
  };

  const mediaReady = !needsCamera || (allPermissionsGranted && Boolean(cameraStream));

  const handleStartTest = async () => {
    if (!mediaReady || !rulesAccepted) {
      return;
    }

    if (!proctoring || proctoring.checks.includes("proctoring_fullscreen_exit")) {
      try {
        await document.documentElement.requestFullscreen();
      } catch {
        // Fullscreen may be blocked; exam still proceeds.
      }
    }

    setExamMediaStreams(needsCamera ? cameraStream : null, null);
    markExamPermissionsComplete();
    router.replace("/test");
  };

  const statusTone = (status: ExamPermissionStatus) =>
    status === "granted" ? "success" : status === "denied" ? "danger" : status === "unsupported" ? "warning" : "neutral";

  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas px-4 py-8">
      <div className="flex w-full max-w-2xl flex-col gap-6 rounded-sheet border border-border bg-surface p-5 shadow-overlay sm:p-8">
        <div className="flex items-center gap-3">
          <span className="text-success">
            <SuccessIconSVG width={28} />
          </span>
          <p className="text-body font-semibold text-ink">{t("loginSuccessful")}</p>
        </div>
        {needsCamera ? (
          <Stepper steps={[t("cameraTitle") + " · " + t("microphoneTitle"), t("rulesTitle")]} current={step === "permissions" ? 0 : 1} />
        ) : null}

        {step === "permissions" ? (
          <div className="flex flex-col gap-6">
            <p className="text-body text-ink">{t("intro")}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {permissionCards.map(({ key, status, title, actionLabel }) => {
                const isGranted = status === "granted";
                return (
                  <div key={key} className="flex flex-col gap-3 rounded-card border border-border bg-canvas p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-body-sm font-semibold text-ink">{title}</p>
                      <StatusPill tone={statusTone(status)}>{statusLabel(status)}</StatusPill>
                    </div>
                    <Button
                      variant={isGranted ? "secondary" : "primary"}
                      size="sm"
                      disabled={isGranted}
                      onClick={() => void requestCameraAndMicrophone()}
                    >
                      {isGranted ? t("status.granted") : actionLabel}
                    </Button>
                  </div>
                );
              })}
            </div>
            {errorMessage ? (
              <p role="alert" className="text-body-sm text-danger">
                {errorMessage}
              </p>
            ) : null}
            <div className="flex justify-end border-t border-border pt-4">
              <Button rightIcon={<RightArrowIconSVG className="size-4" />} disabled={!allPermissionsGranted} onClick={handleContinue}>
                {t("nextStep")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <h1 className="text-title-sm font-semibold text-ink">{t("rulesTitle")}</h1>
            <ol className="flex list-decimal flex-col gap-2 pl-5 text-body text-ink">
              {rulesFor(proctoring).map((rule) => (
                <li key={rule.key}>{t(`rules.${rule.key}` as never, rule.values as never)}</li>
              ))}
            </ol>
            {proctoring ? (
              <section className="rounded-card border border-border bg-canvas p-4" aria-labelledby="watched-title">
                <h2 id="watched-title" className="text-body-sm font-semibold text-ink">
                  {t("watchedTitle")}
                </h2>
                {proctoring.checks.length ? (
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {proctoring.checks.map((check) => (
                      <li key={check}>
                        <StatusPill tone="neutral">{featureName(check)}</StatusPill>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-body-sm text-ink-muted">{t("watchedNone")}</p>
                )}
              </section>
            ) : null}
            <div className="rounded-card border border-border bg-canvas p-4">
              <Checkbox label={t("accept")} checked={rulesAccepted} onChange={(event) => setRulesAccepted(event.target.checked)} />
            </div>
            <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-between">
              {needsCamera ? (
                <Button variant="secondary" onClick={() => setStep("permissions")}>
                  {t("back")}
                </Button>
              ) : (
                <span />
              )}
              <Button
                rightIcon={<RightArrowIconSVG className="size-4" />}
                disabled={!rulesAccepted || !mediaReady}
                onClick={() => void handleStartTest()}
              >
                {t("startTest")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentExamPermissionFlow;
