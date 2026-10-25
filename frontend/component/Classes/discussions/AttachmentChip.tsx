"use client";

import { useTranslations } from "next-intl";
import { IconButton } from "@/design/ui";
import { CloseIcon } from "@/design/ui/icons";
import { formatFileSize, isDiscussionImageAttachment, resolveAttachmentUrl } from "@/utils/classes/discussionHelpers";

/** One attached file: a thumbnail or file badge, its name (opens it) and size; optionally removable. */
const AttachmentChip = ({ attachment, onRemove }: { attachment: DiscussionAttachment; onRemove?: () => void }) => {
  const t = useTranslations("discussions.attachment");
  const href = resolveAttachmentUrl(attachment.url);
  const isImage = isDiscussionImageAttachment(attachment);
  const extension = attachment.file_name.split(".").pop()?.toUpperCase().slice(0, 4) || "FILE";

  return (
    <div className="flex items-center gap-3 rounded-input border border-border bg-surface px-3 py-2">
      {isImage ? (
        <span className="size-10 shrink-0 overflow-hidden rounded-input bg-canvas" style={{ backgroundImage: `url("${href}")`, backgroundSize: "cover", backgroundPosition: "center" }} aria-hidden="true" />
      ) : (
        <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-input bg-danger-soft text-caption font-bold text-danger">
          {extension}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <a href={href} target="_blank" rel="noreferrer" className="block truncate text-body-sm font-medium text-ink hover:underline">
          {attachment.file_name}
        </a>
        <p className="text-caption text-ink-muted">{formatFileSize(attachment.size)}</p>
      </div>
      {onRemove ? <IconButton size="sm" label={t("remove", { name: attachment.file_name })} icon={<CloseIcon />} onClick={onRemove} /> : null}
    </div>
  );
};

export default AttachmentChip;
