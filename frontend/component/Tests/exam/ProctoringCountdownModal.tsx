"use client";

import { useTranslations } from "next-intl";
import useFormat from "@/i18n/useFormat";
import { useAppSelector } from "@/lib/hooks";
import ExamDialog from "./ExamDialog";

/** "Resolve this within N seconds": shown while screen sharing stops or a second display is attached. */
const ProctoringCountdownModal = () => {
  const t = useTranslations("proctoring.countdown");
  const format = useFormat();
  const activeCountdown = useAppSelector((state) => state.proctoring.activeCountdown);

  if (!activeCountdown) {
    return null;
  }

  return (
    <ExamDialog
      open
      tone="warning"
      title={t(`${activeCountdown.type}.title`)}
      description={t(`${activeCountdown.type}.message`)}
      icon={<span className="text-body font-bold">{format.number(activeCountdown.secondsRemaining)}</span>}
    >
      <p className="text-body-sm font-medium text-warning" aria-live="polite">
        {t("resolveWithin", { seconds: activeCountdown.secondsRemaining })}
      </p>
    </ExamDialog>
  );
};

export default ProctoringCountdownModal;
