"use client";

import Image from "next/image";
import { cn } from "@/design/ui";
import { isDiscussionImageAttachment, resolveAttachmentUrl } from "@/utils/classes/discussionHelpers";
import AttachmentChip from "./AttachmentChip";

/** The files attached to a post or message: images shown inline, other files as chips. */
const DiscussionAttachmentList = ({ attachments, compact = false }: { attachments: DiscussionAttachment[]; compact?: boolean }) => {
  if (!attachments.length) {
    return null;
  }
  const images = attachments.filter(isDiscussionImageAttachment);
  const files = attachments.filter((attachment) => !isDiscussionImageAttachment(attachment));

  return (
    <div className="flex flex-col gap-2">
      {images.length ? (
        <div className={cn("flex flex-col gap-2", images.length > 1 && "sm:grid sm:grid-cols-2")}>
          {images.map((attachment) => {
            const href = resolveAttachmentUrl(attachment.url);
            return (
              <a key={attachment.id} href={href} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-input bg-canvas">
                {/* unoptimized: uploads come from any storage host and size. */}
                <Image
                  src={href}
                  alt={attachment.file_name}
                  width={0}
                  height={0}
                  sizes="100vw"
                  unoptimized
                  className={cn("h-auto w-full object-contain", compact ? "max-h-80" : "max-h-[480px]")}
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
