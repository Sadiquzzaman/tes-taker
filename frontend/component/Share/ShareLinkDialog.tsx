"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { useToast } from "@/component/Toast/ToastContext";
import { Button, cn, focusRing, Modal } from "@/design/ui";
import GmailImage from "@/public/assets/image/share_modal/gmail.png";
import LinkedInImage from "@/public/assets/image/share_modal/Linkedin.png";
import MessengerImage from "@/public/assets/image/share_modal/messenger2.png";
import TelegramImage from "@/public/assets/image/share_modal/telegram2.png";
import WhatsAppImage from "@/public/assets/image/share_modal/whatsapp-icon.png";
import CopyIconSVG from "../svg/CopyIconSVG";

export interface ShareLinkDialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  /** Extra lines under the description (who can join, exclusions…). */
  notes?: ReactNode;
  linkLabel: string;
  link: string;
  /** Text sent with the link in chat apps, and the email subject. */
  message: string;
  emailSubject: string;
}

const open = (url: string) => window.open(url, "_blank", "noopener,noreferrer");

/** A join link to copy or send through WhatsApp, Messenger, Telegram, LinkedIn or Gmail. */
const ShareLinkDialog = ({ open: isOpen, onClose, title, description, notes, linkLabel, link, message, emailSubject }: ShareLinkDialogProps) => {
  const t = useTranslations("classes.shareModal");
  const { triggerToast } = useToast();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      triggerToast({ type: "success", title: t("copiedTitle"), description: t("copiedDetail") });
    } catch {
      // Clipboard can be blocked; the link stays visible to copy by hand.
    }
  };

  const targets = [
    { key: "whatsapp", label: "WhatsApp", image: WhatsAppImage, url: `https://wa.me/?text=${encodeURIComponent(message)}` },
    { key: "messenger", label: "Messenger", image: MessengerImage, url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}` },
    { key: "telegram", label: "Telegram", image: TelegramImage, url: `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(emailSubject)}` },
    { key: "linkedin", label: "LinkedIn", image: LinkedInImage, url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(link)}` },
    {
      key: "gmail",
      label: "Gmail",
      image: GmailImage,
      url: `https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(message)}`,
    },
  ];

  return (
    <Modal open={isOpen} onClose={onClose} title={title} description={description} footer={<Button onClick={onClose}>{t("done")}</Button>}>
      <div className="flex flex-col gap-5">
        {notes ? <div className="flex flex-col gap-1 text-body-sm text-ink-muted">{notes}</div> : null}
        <div className="flex flex-col gap-2">
          <p className="text-body-sm font-medium text-ink">{linkLabel}</p>
          <div className="flex items-center gap-2 rounded-input bg-canvas py-1.5 pl-3 pr-1.5">
            <p className="min-w-0 flex-1 truncate text-body-sm text-info">{link}</p>
            <Button size="sm" leftIcon={<CopyIconSVG width={14} />} onClick={() => void copy()}>
              {t("copy")}
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-body-sm font-medium text-ink">{t("direct")}</p>
          <ul className="flex flex-wrap gap-4">
            {targets.map((target) => (
              <li key={target.key}>
                <button
                  type="button"
                  onClick={() => open(target.url)}
                  className={cn("flex flex-col items-center gap-1 rounded-input p-1 text-caption text-ink-muted hover:text-ink", focusRing)}
                >
                  <Image src={target.image} alt="" width={40} height={40} />
                  {target.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Modal>
  );
};

export default ShareLinkDialog;
