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
        className={`max-w-[85%] rounded-card px-3.5 py-2.5 ${
          isOwn ? "rounded-br-md bg-primary-soft text-ink" : "rounded-bl-md bg-canvas text-ink"
        }`}
      >
        {!isOwn ? (
          <p className="mb-1 text-caption font-semibold text-primary">{message.sender.name}</p>
        ) : null}
        {message.content ? (
          <p className="whitespace-pre-wrap text-body-sm leading-5">{message.content}</p>
        ) : null}
        {message.attachments?.length ? (
          <div className="mt-2">
            <DiscussionAttachmentList attachments={message.attachments} compact />
          </div>
        ) : null}
        <p className={`mt-1 text-caption ${isOwn ? "text-primary-hover" : "text-ink-muted"}`}>
          {formatDiscussionTime(message.created_at)}
        </p>
      </div>
    </div>
  );
};

export default ChatBubble;
