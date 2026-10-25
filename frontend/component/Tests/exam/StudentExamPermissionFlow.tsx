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
import { Button, Checkbox, StatusPill, Stepper } from "@/design/ui";

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
        <Stepper steps={[t("cameraTitle") + " · " + t("microphoneTitle"), t("rulesTitle")]} current={step === "permissions" ? 0 : 1} />

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
              {EXAM_RULE_KEYS.map((rule) => (
                <li key={rule}>{t(`rules.${rule}`, { count: PROCTORING_CONFIG.disqualifyAfter })}</li>
              ))}
            </ol>
            <div className="rounded-card border border-border bg-canvas p-4">
              <Checkbox label={t("accept")} checked={rulesAccepted} onChange={(event) => setRulesAccepted(event.target.checked)} />
            </div>
            <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-between">
              <Button variant="secondary" onClick={() => setStep("permissions")}>
                {t("back")}
              </Button>
              <Button
                rightIcon={<RightArrowIconSVG className="size-4" />}
                disabled={!rulesAccepted || !allPermissionsGranted}
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
