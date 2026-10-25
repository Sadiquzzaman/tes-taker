import { resolveMediaUrl, uploadMedia } from "@/utils/media/uploadMedia";

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

export const uploadDiscussionAttachment = async (classId: string, file: File) => {
  const uploaded = await uploadMedia("discussion", file, classId);
  return uploaded as DiscussionAttachment;
};

/** Filter chips on the class feed (labels under discussions.filter). */
export const CATEGORY_FILTERS = ["all", "question", "idea", "resource"] as const;

/** Post types a user can choose (labels under discussions.category). */
export const CATEGORY_OPTIONS: DiscussionPostCategory[] = ["general", "question", "idea", "resource"];

/** Badge colour for a post type. */
export const categoryTone = (category?: DiscussionPostCategory) =>
  category === "question" ? "info" : category === "idea" ? "warning" : category === "resource" ? "success" : "neutral";
