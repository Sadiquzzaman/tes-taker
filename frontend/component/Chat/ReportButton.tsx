"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useToast } from "@/component/Toast/ToastContext";
import { Button, Modal, Textarea } from "@/design/ui";
import { useApiError } from "@/hooks/api/useApiError";
import axiosReq from "@/lib/axios";

/** "Report" on someone else's message (COM-05): a reason, then the school's owners and admins review it. */
const ReportButton = ({ chatType, chatId, message }: { chatType: "GROUP" | "DIRECT"; chatId: string; message: ChatMessage }) => {
  const t = useTranslations("chat");
  const { triggerToast } = useToast();
  const { handleError } = useApiError();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    setBusy(true);
    try {
      await axiosReq.post(`${process.env.NEXT_PUBLIC_BASE_URL}/chat/reports`, { chat_type: chatType, chat_id: chatId, message_id: message.id, reason });
      triggerToast({ title: t("reported"), type: "success" });
      setOpen(false);
      setReason("");
    } catch (err) {
      handleError(err as AxiosError<ApiError>);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        {t("report")}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t("reportTitle")}
        description={t("reportDetail")}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            <Button variant="danger" loading={busy} disabled={!reason.trim()} onClick={() => void send()}>
              {t("reportSend")}
            </Button>
          </>
        }
      >
        <blockquote className="mb-3 border-l-2 border-border pl-2 text-body-sm text-ink-muted">
          {message.author.name}: {message.content || message.attachments.map((a) => a.name).join(", ")}
        </blockquote>
        <Textarea label={t("reportReason")} rows={3} maxLength={300} value={reason} onChange={(event) => setReason(event.target.value)} />
      </Modal>
    </>
  );
};

export default ReportButton;
