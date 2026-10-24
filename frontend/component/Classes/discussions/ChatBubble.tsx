"use client";

import { cn } from "@/design/ui";
import useFormat from "@/i18n/useFormat";
import DiscussionAttachmentList from "./DiscussionAttachments";

/** One private message; the user's own on the right. */
const ChatBubble = ({ message, isOwn }: { message: DiscussionMessage; isOwn: boolean }) => {
  const format = useFormat();

  return (
    <div className={cn("flex", isOwn ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[85%] rounded-card px-3.5 py-2.5 text-ink", isOwn ? "rounded-br-sm bg-primary-soft" : "rounded-bl-sm bg-canvas")}>
        {!isOwn ? <p className="mb-1 text-caption font-semibold text-primary">{message.sender.name}</p> : null}
        {message.content ? <p className="whitespace-pre-wrap text-body-sm">{message.content}</p> : null}
        {message.attachments?.length ? (
          <div className="mt-2">
            <DiscussionAttachmentList attachments={message.attachments} compact />
          </div>
        ) : null}
        <p className="mt-1 text-caption text-ink-muted">{message.created_at ? format.dateTime(message.created_at) : ""}</p>
      </div>
    </div>
  );
};

export default ChatBubble;
