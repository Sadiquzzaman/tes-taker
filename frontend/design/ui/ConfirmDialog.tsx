"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import Button from "./Button";
import Modal from "./Modal";

export interface ConfirmDialogProps {
  open: boolean;
  title: ReactNode;
  /** What will happen, in plain words ("The class and its 32 students' attendance will be deleted."). */
  description?: ReactNode;
  /** The action's name, e.g. "Delete class". Defaults to "Confirm". */
  confirmLabel?: string;
  cancelLabel?: string;
  /** "danger" for destructive actions. */
  tone?: "primary" | "danger";
  /** Disables the buttons while the action runs. */
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** "Are you sure?" for actions that are hard to undo. Cancel is focused first, so Enter never destroys by accident. */
const ConfirmDialog = ({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone = "primary",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) => {
  const t = useTranslations("ui");

  return (
    <Modal
      open={open}
      onClose={loading ? () => {} : onCancel}
      size="sm"
      title={title}
      description={description}
      hideClose
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading} autoFocus>
            {cancelLabel ?? t("cancel")}
          </Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm} loading={loading}>
            {confirmLabel ?? t("confirm")}
          </Button>
        </>
      }
    />
  );
};

export default ConfirmDialog;
