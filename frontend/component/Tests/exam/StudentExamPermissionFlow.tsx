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
      <div className="relative w-full max-w-[640px] rounded-[16px] bg-white shadow-[0_20px_60px_rgba(35,42,37,0.16)]">
        <div className="flex items-center justify-between border-b border-[#E5E5E5] px-6 py-4">
          <div className="flex items-center gap-3">
            <SuccessIconSVG width={28} />
            <p className="text-[18px] font-[600] leading-6 text-[#232A25]">{t("loginSuccessful")}</p>
          </div>
        </div>

        {step === "permissions" ? (
          <div className="flex flex-col gap-6 px-6 py-6">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex size-16 items-center justify-center rounded-full bg-[#EDF4EE] text-[#49734F]">
                <span className="text-[28px]">📷</span>
              </div>
              <p className="max-w-[420px] text-[16px] leading-6 text-[#232A25]">
                {t("intro")}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {permissionCards.map(({ key, status, title, actionLabel }) => {
                const isGranted = status === "granted";

                return (
                  <div key={key} className="rounded-[12px] border border-[#E6ECE7] bg-[#F8FBF8] p-4">
                    <p className="text-[14px] font-[600] leading-5 text-[#232A25]">{title}</p>
                    <p className="mt-1 text-[12px] leading-4 text-[#747775]">{statusLabel(status)}</p>
                    <button
                      type="button"
                      onClick={() => void requestCameraAndMicrophone()}
                      disabled={isGranted}
                      className={`mt-4 h-10 w-full rounded-[8px] px-3 text-[12px] font-[600] leading-4 ${
                        isGranted ? "bg-[#DDE5DE] text-[#747775]" : "bg-[#232A25] text-white"
                      }`}
                    >
                      {isGranted ? t("status.granted") : actionLabel}
                    </button>
                  </div>
                );
              })}
            </div>

            {errorMessage ? <p className="text-center text-[13px] leading-5 text-[#B93815]">{errorMessage}</p> : null}

            <div className="flex items-center justify-between border-t border-[#E5E5E5] pt-4">
              <button
                type="button"
                onClick={handleContinue}
                disabled={!allPermissionsGranted}
                className={`flex h-11 items-center rounded-[10px] px-5 text-[14px] font-[600] leading-4 text-white ${
                  allPermissionsGranted ? "bg-[#49734F]" : "cursor-not-allowed bg-[#8BA28F]"
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
              <div className="flex size-16 items-center justify-center rounded-full bg-[#EDF4EE] text-[#49734F]">
                <span className="text-[28px]">🛡</span>
              </div>
              <p className="text-[20px] font-[600] leading-6 text-[#232A25]">{t("rulesTitle")}</p>
            </div>

            <ol className="mx-auto flex w-full max-w-[520px] list-decimal flex-col gap-3 pl-5 text-[14px] leading-6 text-[#232A25]">
              {EXAM_RULE_KEYS.map((rule) => (
                <li key={rule}>{t(`rules.${rule}`, { count: PROCTORING_CONFIG.disqualifyAfter })}</li>
              ))}
            </ol>

            <label className="mx-auto flex w-full max-w-[520px] items-start gap-3 rounded-[10px] border border-[#E6ECE7] bg-[#F8FBF8] p-4">
              <input
                type="checkbox"
                checked={rulesAccepted}
                onChange={(event) => setRulesAccepted(event.target.checked)}
                className="mt-1 size-4 accent-[#49734F]"
              />
              <span className="text-[14px] leading-5 text-[#232A25]">{t("accept")}</span>
            </label>

            <div className="flex items-center justify-between border-t border-[#E5E5E5] pt-4">
              <button
                type="button"
                onClick={() => setStep("permissions")}
                className="h-11 rounded-[10px] border border-[#DDE5DE] px-5 text-[14px] font-[600] leading-4 text-[#232A25]"
              >
                {t("back")}
              </button>
              <button
                type="button"
                onClick={() => void handleStartTest()}
                disabled={!rulesAccepted || !allPermissionsGranted}
                className={`flex h-11 items-center rounded-[10px] px-5 text-[14px] font-[600] leading-4 text-white ${
                  rulesAccepted && allPermissionsGranted ? "bg-[#49734F]" : "cursor-not-allowed bg-[#8BA28F]"
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
