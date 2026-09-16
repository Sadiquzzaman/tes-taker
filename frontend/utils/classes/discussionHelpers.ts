import axiosReq from "@/lib/axios";

const API_ORIGIN = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/api\/v1\/?$/, "");

export const resolveAttachmentUrl = (url: string) => {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/")) return `${API_ORIGIN}${url}`;
  return url;
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
  const formData = new FormData();
  formData.append("file", file);
  const response = await axiosReq.post<ApiResponse<DiscussionAttachment>>(
    `${process.env.NEXT_PUBLIC_BASE_URL}/uploads/discussion?classId=${encodeURIComponent(classId)}`,
    formData,
    {
      headers: { "Content-Type": "multipart/form-data" },
    },
  );
  return response.data.payload;
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
