import { useState } from "react";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { setOpenShareClassModal } from "@/lib/features/classSlice";
import { useToast } from "@/component/Toast/ToastContext";
import { buildClassJoinLink } from "@/utils/frontendAppUrl";
import { useTranslations } from "next-intl";

export default function useShareClass() {
  const { openShareClassModal: classData } = useAppSelector((state) => state.class);
  const open = Boolean(classData);
  const dispatch = useAppDispatch();
  const { triggerToast } = useToast();
  const t = useTranslations("classes.shareModal");
  const [classLink, setClassLink] = useState("");
  // Keep the last link while the modal closes, so the text does not go blank.
  const nextClassLink = classData?.id ? buildClassJoinLink(classData.id) : null;
  if (nextClassLink && nextClassLink !== classLink) {
    setClassLink(nextClassLink);
  }

  const handleClose = () => {
    dispatch(setOpenShareClassModal(null));
  };

  const shareWhatsApp = () => {
    const message = t("message", { link: classLink });
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  };

  const shareGmail = () => {
    const subject = t("subject");
    const body = t("message", { link: classLink });
    window.open(
      `https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
      "_blank",
    );
  };

  const shareLinkedIn = () => {
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(classLink)}`, "_blank");
  };

  const shareTelegram = () => {
    const message = t("subject");
    window.open(
      `https://t.me/share/url?url=${encodeURIComponent(classLink)}&text=${encodeURIComponent(message)}`,
      "_blank",
    );
  };

  const shareMessenger = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${classLink}`, "_blank");
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(classLink);
      triggerToast({
        type: "success",
        title: t("copiedTitle"),
        description: t("copiedDetail"),
      });
    } catch (err) {
      console.error("Failed to copy: ", err);
    }
  };

  return {
    classData,
    open,
    classLink,
    handleClose,
    shareWhatsApp,
    shareGmail,
    shareLinkedIn,
    shareTelegram,
    shareMessenger,
    handleCopyLink,
  };
}
