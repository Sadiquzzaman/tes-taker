"use client";

import { useTranslations } from "next-intl";
import { Drawer, Skeleton } from "@/design/ui";
import useGradingModal from "@/hooks/grading/useGradingModal";
import GradingEditView from "./GradingEditView";
import GradingResultView from "./GradingResultView";

/** The drawer to mark one submission, or to read its result. */
const GradingModel = () => {
  const t = useTranslations("grading.modal");
  const { data, handleClose, loading, modalTitle, openModal } = useGradingModal();

  return (
    <Drawer wide open={Boolean(openModal)} onClose={handleClose} title={modalTitle}>
      {loading ? (
        <Skeleton lines={8} />
      ) : !data ? (
        <p className="py-10 text-center text-body-sm text-ink-muted">{t("empty")}</p>
      ) : openModal === "result" ? (
        <GradingResultView data={data} />
      ) : (
        <GradingEditView data={data} />
      )}
    </Drawer>
  );
};

export default GradingModel;
