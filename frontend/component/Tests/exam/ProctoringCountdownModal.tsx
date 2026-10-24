"use client";

import CreateModal from "@/component/Tests/Create/CreateModal";
import { useAppSelector } from "@/lib/hooks";
import { useTranslations } from "next-intl";

const ProctoringCountdownModal = () => {
  const activeCountdown = useAppSelector((state) => state.proctoring.activeCountdown);
  const t = useTranslations("proctoring.countdown");

  if (!activeCountdown) {
    return null;
  }

  return (
    <CreateModal open onClose={() => {}} maxWidthClassName="max-w-[460px]" panelClassName="p-6 sm:p-7">
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="text-title font-semibold leading-7 tracking-tight text-ink">{t(`${activeCountdown.type}.title`)}</p>
        <div className="flex size-24 items-center justify-center rounded-full border-4 border-warning text-display font-bold text-warning">
          {activeCountdown.secondsRemaining}
        </div>
        <p className="text-body-sm leading-6 text-ink-muted">{t(`${activeCountdown.type}.message`)}</p>
        <p className="text-body-sm leading-5 text-warning">
          {t("resolveWithin", { seconds: activeCountdown.secondsRemaining })}
        </p>
      </div>
    </CreateModal>
  );
};

export default ProctoringCountdownModal;
