"use client";

import RightArrowIconSVG from "@/component/svg/RightArrowIconSVG";
import SuccessIconSVG from "@/component/svg/SuccessIconSVG";
import useExamPermissions, { type ExamPermissionStatus } from "@/hooks/tests/proctoring/useExamPermissions";
import { EXAM_RULE_KEYS } from "@/utils/tests/proctoring";
import { PROCTORING_CONFIG } from "@/utils/tests/proctoringConfig";
import { markExamPermissionsComplete, setExamMediaStreams } from "@/utils/tests/examSessionMedia";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

type PermissionStep = "permissions" | "rules";

const StudentExamPermissionFlow = () => {
  const router = useRouter();
  const t = useTranslations("exam.permissions");
  const [step, setStep] = useState<PermissionStep>("permissions");
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

  const handleStartTest = async () => {
    if (!allPermissionsGranted || !rulesAccepted || !cameraStream) {
      return;
    }

    try {
      await document.documentElement.requestFullscreen();
    } catch {
      // Fullscreen may be blocked; exam still proceeds.
    }

    setExamMediaStreams(cameraStream, null);
    markExamPermissionsComplete();
    router.replace("/test");
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#4A4A4A]/70 px-4 py-8">
      <div className="relative w-full max-w-[640px] rounded-sheet bg-surface shadow-[0_20px_60px_rgba(35,42,37,0.16)]">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <SuccessIconSVG width={28} />
            <p className="text-title-sm font-semibold leading-6 text-ink">{t("loginSuccessful")}</p>
          </div>
        </div>

        {step === "permissions" ? (
          <div className="flex flex-col gap-6 px-6 py-6">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex size-16 items-center justify-center rounded-full bg-primary-soft text-primary">
                <span className="text-display">📷</span>
              </div>
              <p className="max-w-[420px] text-body leading-6 text-ink">
                {t("intro")}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {permissionCards.map(({ key, status, title, actionLabel }) => {
                const isGranted = status === "granted";

                return (
                  <div key={key} className="rounded-card border border-border bg-primary-soft p-4">
                    <p className="text-body-sm font-semibold leading-5 text-ink">{title}</p>
                    <p className="mt-1 text-caption leading-4 text-ink-muted">{statusLabel(status)}</p>
                    <button
                      type="button"
                      onClick={() => void requestCameraAndMicrophone()}
                      disabled={isGranted}
                      className={`mt-4 h-10 w-full rounded-input px-3 text-caption font-semibold leading-4 ${
                        isGranted ? "bg-border text-ink-muted" : "bg-ink text-ink-inverse"
                      }`}
                    >
                      {isGranted ? t("status.granted") : actionLabel}
                    </button>
                  </div>
                );
              })}
            </div>

            {errorMessage ? <p className="text-center text-body-sm leading-5 text-danger">{errorMessage}</p> : null}

            <div className="flex items-center justify-between border-t border-border pt-4">
              <button
                type="button"
                onClick={handleContinue}
                disabled={!allPermissionsGranted}
                className={`flex h-11 items-center rounded-card px-5 text-body-sm font-semibold leading-4 text-ink-inverse ${
                  allPermissionsGranted ? "bg-primary" : "cursor-not-allowed bg-primary/60"
                }`}
              >
                {t("nextStep")}
                <RightArrowIconSVG className="ml-2 size-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6 px-6 py-6">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex size-16 items-center justify-center rounded-full bg-primary-soft text-primary">
                <span className="text-display">🛡</span>
              </div>
              <p className="text-title-sm font-semibold leading-6 text-ink">{t("rulesTitle")}</p>
            </div>

            <ol className="mx-auto flex w-full max-w-[520px] list-decimal flex-col gap-3 pl-5 text-body-sm leading-6 text-ink">
              {EXAM_RULE_KEYS.map((rule) => (
                <li key={rule}>{t(`rules.${rule}`, { count: PROCTORING_CONFIG.disqualifyAfter })}</li>
              ))}
            </ol>

            <label className="mx-auto flex w-full max-w-[520px] items-start gap-3 rounded-card border border-border bg-primary-soft p-4">
              <input
                type="checkbox"
                checked={rulesAccepted}
                onChange={(event) => setRulesAccepted(event.target.checked)}
                className="mt-1 size-4 accent-primary"
              />
              <span className="text-body-sm leading-5 text-ink">{t("accept")}</span>
            </label>

            <div className="flex items-center justify-between border-t border-border pt-4">
              <button
                type="button"
                onClick={() => setStep("permissions")}
                className="h-11 rounded-card border border-border px-5 text-body-sm font-semibold leading-4 text-ink"
              >
                {t("back")}
              </button>
              <button
                type="button"
                onClick={() => void handleStartTest()}
                disabled={!rulesAccepted || !allPermissionsGranted}
                className={`flex h-11 items-center rounded-card px-5 text-body-sm font-semibold leading-4 text-ink-inverse ${
                  rulesAccepted && allPermissionsGranted ? "bg-primary" : "cursor-not-allowed bg-primary/60"
                }`}
              >
                {t("startTest")}
                <RightArrowIconSVG className="ml-2 size-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentExamPermissionFlow;
