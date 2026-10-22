"use client";

import DiscussionAttachmentList from "./DiscussionAttachments";
import { formatDiscussionTime } from "@/utils/classes/discussionHelpers";

const ChatBubble = ({
  message,
  isOwn,
}: {
  message: DiscussionMessage;
  isOwn: boolean;
}) => {
  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-[14px] px-3.5 py-2.5 ${
          isOwn ? "rounded-br-md bg-[#E8F5E9] text-[#0F1A12]" : "rounded-bl-md bg-[#F2F4F7] text-[#0F1A12]"
        }`}
      >
        {!isOwn ? (
          <p className="mb-1 text-[12px] font-semibold text-[#49734F]">{message.sender.name}</p>
        ) : null}
        {message.content ? (
          <p className="whitespace-pre-wrap text-[14px] leading-5">{message.content}</p>
        ) : null}
        {message.attachments?.length ? (
          <div className="mt-2">
            <DiscussionAttachmentList attachments={message.attachments} compact />
          </div>
        ) : null}
        <p className={`mt-1 text-[11px] ${isOwn ? "text-[#3F6B4A]" : "text-[#667085]"}`}>
          {formatDiscussionTime(message.created_at)}
        </p>
      </div>
    </div>
  );
};

export default ChatBubble;
