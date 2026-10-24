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
    <div className="flex items-center gap-3 rounded-card border border-border bg-surface px-3 py-2">
      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={href} alt={attachment.file_name} className="h-10 w-10 rounded object-cover" />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded bg-danger-soft text-caption font-bold text-danger">
          PDF
        </div>
      )}
      <div className="min-w-0 flex-1">
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="block truncate text-body-sm font-medium text-ink hover:underline"
        >
          {attachment.file_name}
        </a>
        <p className="text-caption text-ink-muted">{formatFileSize(attachment.size)}</p>
      </div>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="text-caption font-medium text-danger hover:underline"
        >
          Remove
        </button>
      ) : null}
    </div>
  );
};

export default AttachmentChip;
