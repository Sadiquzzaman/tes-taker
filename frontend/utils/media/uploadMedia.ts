import axiosReq from "@/lib/axios";

export type MediaUploadPurpose = "discussion" | "exam" | "image";

export type UploadedMedia = {
  id: string;
  key: string;
  url: string;
  file_name: string;
  mime_type: string;
  size: number;
  kind: "image" | "file";
  purpose?: MediaUploadPurpose;
};

const API_ORIGIN = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/api\/v1\/?$/, "");

/** Absolute-ize relative `/uploads/...` URLs from the local storage driver. */
export const resolveMediaUrl = (url: string) => {
  if (!url) return "";
  if (/^https?:\/\//i.test(url) || url.startsWith("data:")) return url;
  if (url.startsWith("/")) return `${API_ORIGIN}${url}`;
  return url;
};

/**
 * Upload a file through the backend StorageService (local or S3).
 * - discussion: images + docs; requires scopeId = classId
 * - exam / image: images only; scopeId optional (examId, userId, …)
 */
export const uploadMedia = async (
  purpose: MediaUploadPurpose,
  file: File,
  scopeId?: string,
): Promise<UploadedMedia> => {
  const formData = new FormData();
  formData.append("file", file);

  const params = new URLSearchParams({ purpose });
  if (scopeId?.trim()) {
    params.set("scopeId", scopeId.trim());
  }

  const response = await axiosReq.post<ApiResponse<UploadedMedia>>(
    `${process.env.NEXT_PUBLIC_BASE_URL}/uploads/media?${params.toString()}`,
    formData,
    {
      headers: { "Content-Type": "multipart/form-data" },
    },
  );

  return response.data.payload;
};

export const uploadExamImage = (file: File, examId?: string) =>
  uploadMedia("exam", file, examId || "draft");
