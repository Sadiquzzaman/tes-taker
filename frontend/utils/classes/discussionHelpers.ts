import { resolveMediaUrl, uploadMedia, type UploadOptions } from "@/utils/media/uploadMedia";

export const resolveAttachmentUrl = (url: string) => resolveMediaUrl(url);

export const isDiscussionImageAttachment = (attachment: DiscussionAttachment): boolean => {
  if (attachment.kind === "image") {
    return true;
  }
  return Boolean(attachment.mime_type?.toLowerCase().startsWith("image/"));
};

export const formatFileSize = (bytes: number) => {
  if (!bytes || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/** Uploads one attachment; `storageWarning` is true when the workspace has used 90% of its storage. */
export const uploadDiscussionAttachment = async (classId: string, file: File, options?: UploadOptions) => {
  const uploaded = await uploadMedia("discussion", file, classId, options);
  const attachment: DiscussionAttachment = {
    id: uploaded.id,
    key: uploaded.key,
    url: uploaded.url,
    file_name: uploaded.file_name,
    mime_type: uploaded.mime_type,
    size: uploaded.size,
    kind: uploaded.kind,
  };
  return { attachment, storageWarning: Boolean(uploaded.storage_warning) };
};

/** Filter chips on the class feed (labels under discussions.filter). */
export const CATEGORY_FILTERS = ["all", "question", "idea", "resource"] as const;

/** Post types a user can choose (labels under discussions.category). */
export const CATEGORY_OPTIONS: DiscussionPostCategory[] = ["general", "question", "idea", "resource"];

/** Badge colour for a post type. */
export const categoryTone = (category?: DiscussionPostCategory) =>
  category === "question" ? "info" : category === "idea" ? "warning" : category === "resource" ? "success" : "neutral";
