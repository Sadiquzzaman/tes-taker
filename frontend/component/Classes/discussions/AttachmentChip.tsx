"use client";

import { formatFileSize, isDiscussionImageAttachment, resolveAttachmentUrl } from "@/utils/classes/discussionHelpers";

const AttachmentChip = ({
  attachment,
  onRemove,
}: {
  attachment: DiscussionAttachment;
  onRemove?: () => void;
}) => {
  const href = resolveAttachmentUrl(attachment.url);
  const isImage = isDiscussionImageAttachment(attachment);

  return (
    <div className="flex items-center gap-3 rounded-[10px] border border-[#E5E7EB] bg-white px-3 py-2">
      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={href} alt={attachment.file_name} className="h-10 w-10 rounded object-cover" />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded bg-[#FEE4E2] text-[11px] font-bold text-[#B42318]">
          PDF
        </div>
      )}
      <div className="min-w-0 flex-1">
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="block truncate text-[13px] font-medium text-[#101828] hover:underline"
        >
          {attachment.file_name}
        </a>
        <p className="text-[12px] text-[#667085]">{formatFileSize(attachment.size)}</p>
      </div>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="text-[12px] font-medium text-[#B42318] hover:underline"
        >
          Remove
        </button>
      ) : null}
    </div>
  );
};

export default AttachmentChip;
