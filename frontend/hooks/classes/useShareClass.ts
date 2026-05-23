import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { setOpenShareClassModal } from "@/lib/features/classSlice";
import { useToast } from "@/component/Toast/ToastContext";

export default function useShareClass() {
  const { openShareClassModal: classData } = useAppSelector((state) => state.class);
  const open = Boolean(classData);
  const dispatch = useAppDispatch();
  const { triggerToast } = useToast();
  const [classLink, setClassLink] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined" && classData?.id) {
      const href = window.location.href;
      const baseUrl = href.split("/classes")[0];
      const link = `${baseUrl}/join/class/${classData.id}`;
      setClassLink(link);
    }
  }, [classData]);

  const handleClose = () => {
    dispatch(setOpenShareClassModal(null));
  };

  const shareWhatsApp = () => {
    const message = `Join my class: ${classLink}`;
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  };

  const shareGmail = () => {
    const subject = "Join my class";
    const body = `Join my class using this link:\n${classLink}`;
    window.open(
      `https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
      "_blank",
    );
  };

  const shareLinkedIn = () => {
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(classLink)}`, "_blank");
  };

  const shareTelegram = () => {
    const message = `Join my class`;
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
        title: "Link copied!",
        description: "Link successfully copied to clipboard!",
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
