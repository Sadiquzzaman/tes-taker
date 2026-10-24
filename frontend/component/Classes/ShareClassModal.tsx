"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { Button, cn, focusRing, Modal } from "@/design/ui";
import useShareClass from "@/hooks/classes/useShareClass";
import GmailImage from "@/public/assets/image/share_modal/gmail.png";
import LinkedInImage from "@/public/assets/image/share_modal/Linkedin.png";
import MessengerImage from "@/public/assets/image/share_modal/messenger2.png";
import TelegramImage from "@/public/assets/image/share_modal/telegram2.png";
import WhatsAppImage from "@/public/assets/image/share_modal/whatsapp-icon.png";
import CopyIconSVG from "../svg/CopyIconSVG";

/** Share a class's join link (shown after creating a class, and from Share class). */
const ShareClassModal = () => {
  const t = useTranslations("classes.shareModal");
  const { classData, open, classLink, handleClose, shareWhatsApp, shareGmail, shareLinkedIn, shareTelegram, shareMessenger, handleCopyLink } =
    useShareClass();
  const isNew = classData?.type === "new";
  const name = classData?.class_name ?? "";

  const targets = [
    { key: "whatsapp", label: "WhatsApp", image: WhatsAppImage, onClick: shareWhatsApp },
    { key: "messenger", label: "Messenger", image: MessengerImage, onClick: shareMessenger },
    { key: "telegram", label: "Telegram", image: TelegramImage, onClick: shareTelegram },
    { key: "linkedin", label: "LinkedIn", image: LinkedInImage, onClick: shareLinkedIn },
    { key: "gmail", label: "Gmail", image: GmailImage, onClick: shareGmail },
  ];

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={isNew ? t("created") : t("title")}
      description={
        isNew ? t("createdDetail", { name, count: classData?.classStudents?.length ?? 0 }) : t("shareDetail", { name })
      }
      footer={<Button onClick={handleClose}>{t("done")}</Button>}
    >
      <div className="flex flex-col gap-5">
        <p className="text-body-sm text-ink-muted">{t("anyone")}</p>
        <div className="flex flex-col gap-2">
          <p className="text-body-sm font-medium text-ink">{t("link")}</p>
          <div className="flex items-center gap-2 rounded-input bg-canvas py-1.5 pl-3 pr-1.5">
            <p className="min-w-0 flex-1 truncate text-body-sm text-info">{classLink}</p>
            <Button size="sm" leftIcon={<CopyIconSVG width={14} />} onClick={() => void handleCopyLink()}>
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
                  onClick={target.onClick}
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

export default ShareClassModal;
