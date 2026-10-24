import Image from "next/image";
import CrossIconSVG from "../svg/CrossIconSVG";
import CopyIconSVG from "../svg/CopyIconSVG";
import WhatsAppImage from "@/public/assets/image/share_modal/whatsapp-icon.png";
import MessengerImage from "@/public/assets/image/share_modal/messenger2.png";
import GmailImage from "@/public/assets/image/share_modal/gmail.png";
import TelegramImage from "@/public/assets/image/share_modal/telegram2.png";
import LinkedInImage from "@/public/assets/image/share_modal/Linkedin.png";
import useShareClass from "@/hooks/classes/useShareClass";

const ShareClassModal = () => {
  const {
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
  } = useShareClass();

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center ${
        open ? "pointer-events-auto" : "pointer-events-none"
      }`}
    >
      <div
        onClick={handleClose}
        className={`absolute inset-0 bg-black/30 transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`}
      />
      <div
        className={`
        relative bg-surface overflow-auto w-full sm:w-[584px]
        sm:rounded-xl transform transition-all duration-1000
        ${open ? "translate-y-0 opacity-100" : "-translate-y-20 opacity-0"}`}
      >
        <div className="p-4 sm:p-8">
          <div className="pb-4 flex justify-between items-center">
            <p className="font-normal text-title-sm text-ink-muted">
              {classData?.type === "new" ? "Successfully created" : "Share class"}
            </p>
            <button className="text-ink-muted" onClick={handleClose}>
              <CrossIconSVG width={24} />
            </button>
          </div>
          {classData?.type === "new" ? (
            <p className="py-4 font-medium text-title text-ink">
              ‘{classData?.class_name}’ created successfully with{" "}
              <span className="text-primary">{classData?.classStudents.length} active invitation</span>
            </p>
          ) : (
            <p className="py-4 font-medium text-title text-ink">
              Share ‘{classData?.class_name}’
            </p>
          )}

          <p className="pb-4 font-normal text-body text-ink-muted">
            Anyone with the link will be able send a joining request in this class.{" "}
          </p>
          <div className="py-4">
            <p className="font-semibold text-body-sm text-ink"> Class join link</p>
            <div className="w-full flex justify-between items-center bg-canvas rounded-lg px-4 py-2 mt-2 gap-2">
              <p className="font-normal text-body text-info">{classLink}</p>
              <div
                onClick={handleCopyLink}
                className="min-w-[72px] h-8 text-ink-inverse bg-ink rounded-lg flex items-center justify-center cursor-pointer gap-2 px-2"
              >
                <CopyIconSVG width={14} />
                <p className="font-medium text-body-sm">Copy</p>
              </div>
            </div>
          </div>
          <div className="pt-4">
            <p className="font-semibold text-body-sm text-ink"> Share directly</p>
            <div className="w-full flex items-center bg-surface rounded-lg px-4 py-2 mt-2 gap-8">
              <div className="cursor-pointer flex flex-col items-center" onClick={shareWhatsApp}>
                <Image src={WhatsAppImage} alt="WhatsApp" width={48} height={48} />
                <p className="font-normal text-caption text-ink-muted">WhatsApp</p>
              </div>
              <div className="cursor-pointer flex flex-col items-center" onClick={shareMessenger}>
                <Image src={MessengerImage} alt="Messenger" width={48} height={48} />
                <p className="font-normal text-caption text-ink-muted">Messenger</p>
              </div>
              <div className="cursor-pointer flex flex-col items-center" onClick={shareTelegram}>
                <Image src={TelegramImage} alt="Telegram" width={48} height={48} />
                <p className="font-normal text-caption text-ink-muted">Telegram</p>
              </div>
              <div className="cursor-pointer flex flex-col items-center" onClick={shareLinkedIn}>
                <Image src={LinkedInImage} alt="LinkedIn" width={48} height={48} />
                <p className="font-normal text-caption text-ink-muted">LinkedIn</p>
              </div>
              <div className="cursor-pointer flex flex-col items-center" onClick={shareGmail}>
                <Image src={GmailImage} alt="Gmail" width={48} height={48} />
                <p className="font-normal text-caption text-ink-muted">Gmail</p>
              </div>
            </div>
          </div>
        </div>
        <div className="p-4 sm:p-8 border-t border-border flex justify-end items-center">
          <button
            onClick={handleClose}
            className="bg-primary text-ink-inverse rounded-lg w-[90px] h-[40px] flex justify-center items-center text-body-sm font-medium"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareClassModal;
