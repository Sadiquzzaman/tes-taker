"use client";

import CreateModal from "@/component/Tests/Create/CreateModal";
import ImportantIconSvg from "@/component/svg/ImportantIconSvg";
import { dismissProctoringWarning } from "@/lib/features/proctoringSlice";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { useTranslations } from "next-intl";

const ProctoringWarningModal = () => {
  const dispatch = useAppDispatch();
  const pendingWarning = useAppSelector((state) => state.proctoring.pendingWarning);
  const isOpen = Boolean(pendingWarning);
  const t = useTranslations("proctoring");

  if (!pendingWarning) {
    return null;
  }

  return (
    <CreateModal open={isOpen} onClose={() => {}} maxWidthClassName="max-w-[460px]" panelClassName="p-6 sm:p-7">
      <div className="flex flex-col gap-5">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-warning-soft text-warning">
            <ImportantIconSvg />
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-title font-semibold leading-7 tracking-tight text-ink">{t("warningTitle")}</p>
            <p className="text-body-sm leading-5 text-ink-muted">{t("warningSubtitle")}</p>
          </div>
        </div>

        <div className="rounded-card border border-warning-soft bg-warning-soft p-4">
          <p className="text-body-sm leading-5 text-ink">{t(`flags.${pendingWarning.type}`)}</p>
          <p className="mt-2 text-body-sm font-semibold leading-5 text-warning">
            {t("currentFlagCount", { count: pendingWarning.flagCount })}
          </p>
        </div>

        <p className="text-body-sm leading-5 text-ink-muted">{t("continueCarefully")}</p>

        <button
          type="button"
          onClick={() => dispatch(dismissProctoringWarning())}
          className="h-11 rounded-card bg-primary px-5 text-body-sm font-semibold leading-4 text-ink-inverse"
        >
          {t("understand")}
        </button>
      </div>
    </CreateModal>
  );
};

export default ProctoringWarningModal;
