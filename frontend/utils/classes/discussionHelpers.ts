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

export const formatDiscussionTime = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
};

export const uploadDiscussionAttachment = async (classId: string, file: File) => {
  const uploaded = await uploadMedia("discussion", file, classId);
  return uploaded as DiscussionAttachment;
};

export const CATEGORY_FILTERS: Array<{ value: DiscussionPostCategory | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "question", label: "Questions" },
  { value: "idea", label: "Ideas" },
  { value: "resource", label: "Resources" },
];

export const CATEGORY_OPTIONS: Array<{ value: DiscussionPostCategory; label: string }> = [
  { value: "general", label: "General" },
  { value: "question", label: "Question" },
  { value: "idea", label: "Idea" },
  { value: "resource", label: "Resource" },
];

export const categoryPillClass = (category?: DiscussionPostCategory) => {
  switch (category) {
    case "question":
      return "bg-[#F4EBFF] text-[#6941C6]";
    case "idea":
      return "bg-[#EFF8FF] text-[#175CD3]";
    case "resource":
      return "bg-[#ECFDF3] text-[#027A48]";
    default:
      return "bg-[#F2F4F7] text-[#344054]";
  }
};
