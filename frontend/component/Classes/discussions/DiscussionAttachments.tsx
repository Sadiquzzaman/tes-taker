"use client";

import AttachmentChip from "./AttachmentChip";
import { isDiscussionImageAttachment, resolveAttachmentUrl } from "@/utils/classes/discussionHelpers";

const DiscussionAttachmentList = ({
  attachments,
  compact = false,
}: {
  attachments: DiscussionAttachment[];
  /** Slightly smaller max height for chat bubbles */
  compact?: boolean;
}) => {
  if (!attachments.length) {
    return null;
  }

  const images = attachments.filter(isDiscussionImageAttachment);
  const files = attachments.filter((attachment) => !isDiscussionImageAttachment(attachment));

  return (
    <div className="flex flex-col gap-2">
      {images.length ? (
        <div className={`flex flex-col gap-2 ${images.length > 1 ? "sm:grid sm:grid-cols-2" : ""}`}>
          {images.map((attachment) => {
            const href = resolveAttachmentUrl(attachment.url);
            return (
              <a
                key={attachment.id}
                href={href}
                target="_blank"
                rel="noreferrer"
                className="block overflow-hidden rounded-[12px] bg-[#F2F4F7]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={href}
                  alt={attachment.file_name}
                  className={`w-full object-contain ${compact ? "max-h-[320px]" : "max-h-[480px]"}`}
                />
              </a>
            );
          })}
        </div>
      ) : null}

      {files.length ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {files.map((attachment) => (
            <AttachmentChip key={attachment.id} attachment={attachment} />
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default DiscussionAttachmentList;
