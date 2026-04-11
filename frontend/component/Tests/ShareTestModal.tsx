import Image from "next/image";
import CrossIconSVG from "../svg/CrossIconSVG";
import CopyIconSVG from "../svg/CopyIconSVG";
import WhatsAppImage from "@/public/assets/image/share_modal/whatsapp-icon.png";
import MessengerImage from "@/public/assets/image/share_modal/messenger2.png";
import GmailImage from "@/public/assets/image/share_modal/gmail.png";
import TelegramImage from "@/public/assets/image/share_modal/telegram2.png";
import LinkedInImage from "@/public/assets/image/share_modal/Linkedin.png";
import { useToast } from "../Toast/ToastContext";
import { useEffect, useState } from "react";
import dayjs from "dayjs";

type ShareTestModalProps = {
  open: boolean;
  setOpen: () => void;
  testData: NewTestShareData;
};

const ShareTestModal = ({ open, setOpen, testData }: ShareTestModalProps) => {
  const { triggerToast } = useToast();
  const [testLink, setTestLink] = useState(testData.shareLink);

  useEffect(() => {
    if (testData.shareLink) {
      setTestLink(testData.shareLink);
      return;
    }

    if (typeof window !== "undefined" && testData.id) {
      setTestLink(`${window.location.origin}/tests?createdTest=${testData.id}`);
    }
  }, [testData.id, testData.shareLink]);

  const handleClose = () => {
    setOpen();
  };

  const shareWhatsApp = () => {
    const message = `Check out this test: ${testLink}`;
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;

    window.open(url, "_blank");
  };
  const shareGmail = () => {
    const subject = `Share test: ${testData.testName}`;
    const body = `Access this test using the link below:\n${testLink}`;

    window.open(
      `https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
      "_blank",
    );
  };
  const shareLinkedIn = () => {
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(testLink)}`, "_blank");
  };
  const shareTelegram = () => {
    const message = `Check out this test`;
    window.open(
      `https://t.me/share/url?url=${encodeURIComponent(testLink)}&text=${encodeURIComponent(message)}`,
      "_blank",
    );
  };
  const shareMessenger = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${testLink}`, "_blank");
  };
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(testLink);
      triggerToast({
        type: "success",
        title: "Link copied!",
        description: "Link successfully copied to clipboard!",
      });
    } catch (err) {
      console.error("Failed to copy: ", err);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center ${open ? "pointer-events-auto" : "pointer-events-none"}`}
    >
      <div
        onClick={handleClose}
        className={`absolute inset-0 bg-black/30 transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`}
      />
      <div
        className={`
        relative bg-white overflow-auto w-full sm:w-[584px]
        sm:rounded-xl transform transition-all duration-1000
        ${open ? "translate-y-0 opacity-100" : "-translate-y-20 opacity-0"}`}
      >
        <div className="p-4 sm:p-8">
          <div className="pb-4 flex justify-between items-center">
            <p className="font-[400] text-[20px] leading-[20px] tracking-[-0.02em] text-[#747775]">
              {testData.type === "new"
                ? testData.test.publishState.publishTiming === "schedule"
                  ? "Test is scheduled"
                  : "Test successfully created"
                : "Share test"}
            </p>
            <button className="text-[#747775]" onClick={handleClose}>
              <CrossIconSVG width={24} />
            </button>
          </div>
          {testData.test.publishState.publishTiming === "schedule" && (
            <p className="py-4 font-[500] text-[24px] leading-[24px] tracking-[-0.02em] text-[#232A25]">
              {`Scheduled for ${dayjs(testData.test.publishState.scheduleAt).format("MMM DD, hh:mm A")}`}
            </p>
          )}
          {testData.test.publishState.publishTiming !== "schedule" && testData.type === "new" && (
            <p className="py-4 font-[500] text-[24px] leading-[24px] tracking-[-0.02em] text-[#232A25]">
              {`‘${testData.testName}’ created successfully.`}
            </p>
          )}
          {testData.test.publishState.publishTiming !== "schedule" && testData.type !== "new" && (
            <p className="py-4 font-[500] text-[24px] leading-[24px] tracking-[-0.02em] text-[#232A25]">
              {`Share ‘${testData.testName}’`}
            </p>
          )}

          {testData.test.publishState.testAudience === "anyone" && (
            <p className="pb-4 font-[400] text-[16px] leading-[20px] tracking-[-0.02em] text-[#747775]">
              Anyone with the link will be able to participate
            </p>
          )}

          {testData.test.publishState.testAudience === "selected_class" && (
            <p className="pb-4 font-[400] text-[16px] leading-[20px] tracking-[-0.02em] text-[#747775]">
              Test shared with Class <span className="font-[700]">{testData.test.publishState.selectedClassId}</span>{" "}
              students. Only these students will be able to join the test.
            </p>
          )}

          {testData.test.publishState.testAudience === "specific_students" && (
            <p className="pb-4 font-[400] text-[16px] leading-[20px] tracking-[-0.02em] text-[#747775]">
              Test shared with <span className="font-[700]">{testData.test.publishState.specificStudents.length}</span>{" "}
              specific students. Only these students will be able to join the test.
            </p>
          )}

          <div className="py-4">
            <p className="font-[600] text-[14px] leading-[125%] tracking-[-0.02em] text-[#0F1A12]"> Test link</p>
            <div className="w-full flex justify-between items-center bg-[#EFF0F3] rounded-lg px-4 py-2 mt-2 gap-2">
              <p className="font-[400] text-[16px] leading-[20px] tracking-[-0.02em] text-[#2765EC]">{testLink}</p>
              <div
                onClick={handleCopyLink}
                className="min-w-[72px] h-8 text-white bg-[#232A25] rounded-lg flex items-center justify-center cursor-pointer gap-2 px-2"
              >
                <CopyIconSVG width={14} />
                <p className="font-[500] text-[14px] leading-[16px] tracking-[-0.02em]">Copy</p>
              </div>
            </div>
          </div>
          <div className="pt-4">
            <p className="font-[600] text-[14px] leading-[125%] tracking-[-0.02em] text-[#0F1A12]"> Share directly</p>
            <div className="w-full flex items-center bg-white rounded-lg px-4 py-2 mt-2 gap-8">
              <div className="cursor-pointer flex flex-col items-center" onClick={shareWhatsApp}>
                <Image src={WhatsAppImage} alt="WhatsApp" width={48} height={48} />
                <p className="font-[400] text-[10px] leading-[12px] tracking-[-0.02em] text-[#747775]">WhatsApp</p>
              </div>
              <div className="cursor-pointer flex flex-col items-center" onClick={shareMessenger}>
                <Image src={MessengerImage} alt="Messenger" width={48} height={48} />
                <p className="font-[400] text-[10px] leading-[12px] tracking-[-0.02em] text-[#747775]">Messenger</p>
              </div>
              <div className="cursor-pointer flex flex-col items-center" onClick={shareTelegram}>
                <Image src={TelegramImage} alt="Telegram" width={48} height={48} />
                <p className="font-[400] text-[10px] leading-[12px] tracking-[-0.02em] text-[#747775]">Telegram</p>
              </div>
              <div className="cursor-pointer flex flex-col items-center" onClick={shareLinkedIn}>
                <Image src={LinkedInImage} alt="LinkedIn" width={48} height={48} />
                <p className="font-[400] text-[10px] leading-[12px] tracking-[-0.02em] text-[#747775]">LinkedIn</p>
              </div>
              <div className="cursor-pointer flex flex-col items-center" onClick={shareGmail}>
                <Image src={GmailImage} alt="Gmail" width={48} height={48} />
                <p className="font-[400] text-[10px] leading-[12px] tracking-[-0.02em] text-[#747775]">Gmail</p>
              </div>
            </div>
          </div>
        </div>
        <div className="p-4 sm:p-8 border-t border-[#E5E5E5] flex justify-end items-center">
          <button
            onClick={handleClose}
            className="bg-[#49734F] text-white rounded-lg w-[90px] h-[40px] flex justify-center items-center text-[14px] leading-[16px] tracking-[-0.02em] font-[500]"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareTestModal;
