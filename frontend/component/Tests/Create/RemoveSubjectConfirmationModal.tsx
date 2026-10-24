"use client";

import { useTranslations } from "next-intl";
import { ConfirmDialog } from "@/design/ui";

/** Confirms removing a subject (and every question under it) from a model test. */
const RemoveSubjectConfirmationModal = ({ open, subjectName, onClose, onConfirm }: RemoveSubjectConfirmationModalProps) => {
  const t = useTranslations("createTest.subjects");

  return (
    <ConfirmDialog
      open={open}
      tone="danger"
      title={t("removeTitle", { name: subjectName })}
      description={t("removeDetail")}
      confirmLabel={t("removeConfirm")}
      onCancel={onClose}
      onConfirm={onConfirm}
    />
  );
};

export default RemoveSubjectConfirmationModal;
