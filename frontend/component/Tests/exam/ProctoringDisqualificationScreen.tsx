"use client";

import CreateModal from "@/component/Tests/Create/CreateModal";
import { useTranslations } from "next-intl";

interface ProctoringDisqualificationScreenProps {
  open: boolean;
  reason?: string | null;
}

const ProctoringDisqualificationScreen = ({ open, reason }: ProctoringDisqualificationScreenProps) => {
  const t = useTranslations("proctoring");

  if (!open) {
    return null;
  }

  return (
    <CreateModal open={open} onClose={() => {}} maxWidthClassName="max-w-[520px]" panelClassName="p-6 sm:p-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-danger-soft text-danger">
          <span className="text-title font-bold">!</span>
        </div>
        <p className="text-title font-semibold leading-7 tracking-tight text-ink">{t("disqualifiedTitle")}</p>
        <p className="text-body-sm leading-6 text-ink-muted">{t("disqualifiedDescription")}</p>
        {reason ? <p className="text-body-sm leading-5 text-danger">{reason}</p> : null}
      </div>
    </CreateModal>
  );
};

export default ProctoringDisqualificationScreen;
