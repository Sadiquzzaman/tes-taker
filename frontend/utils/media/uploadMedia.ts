import axiosReq from "@/lib/axios";
import { compressImageFile, IMAGE_COMPRESS, isCompressibleImage } from "@/utils/media/compressImage";

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

const API_BASE = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/$/, "");
const API_ORIGIN = API_BASE.replace(/\/api\/v1\/?$/, "");

/**
 * Turn stored media URLs into something the browser can load.
 * Direct S3 virtual-hosted URLs 403 when the bucket blocks public access —
 * rewrite those to the backend content proxy.
 */
export const resolveMediaUrl = (url: string) => {
  if (!url) return "";
  if (url.startsWith("data:") || url.startsWith("blob:")) return url;

  const s3Match = url.match(
    /^https?:\/\/([^.]+)\.s3(?:[.-][a-z0-9-]+)?\.amazonaws\.com\/(.+)$/i,
  );
  if (s3Match) {
    const key = decodeURIComponent(s3Match[2].split("?")[0]);
    const proxied = `${API_BASE}/uploads/content?key=${encodeURIComponent(key)}`;
    console.debug("[media] resolveMediaUrl: rewritten S3 URL → proxy", { from: url, to: proxied });
    return proxied;
  }

  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/api/")) return `${API_ORIGIN}${url}`;
  if (url.startsWith("/")) return `${API_ORIGIN}${url}`;
  return url;
};

/**
 * Upload a file through the backend StorageService (local or S3).
 * Images are compressed in the browser first; the API compresses again as a safety net.
 */
export const uploadMedia = async (
  purpose: MediaUploadPurpose,
  file: File,
  scopeId?: string,
): Promise<UploadedMedia> => {
  let uploadFile = file;
  if (isCompressibleImage(file)) {
    uploadFile = await compressImageFile(file);
  }

  const formData = new FormData();
  formData.append("file", uploadFile);

  const params = new URLSearchParams({ purpose });
  if (scopeId?.trim()) {
    params.set("scopeId", scopeId.trim());
  }

  const endpoint = `${API_BASE}/uploads/media?${params.toString()}`;
  console.debug("[media] uploadMedia:start", {
    purpose,
    scopeId,
    name: uploadFile.name,
    type: uploadFile.type,
    originalSize: file.size,
    uploadSize: uploadFile.size,
    endpoint,
  });

  try {
    const response = await axiosReq.post<ApiResponse<UploadedMedia>>(endpoint, formData);
    const payload = response.data.payload;
    const displayUrl = resolveMediaUrl(payload.url);
    console.debug("[media] uploadMedia:success", {
      key: payload.key,
      url: payload.url,
      displayUrl,
      storedSize: payload.size,
      status: response.status,
    });
    return { ...payload, url: displayUrl };
  } catch (error) {
    const axiosError = error as {
      message?: string;
      response?: { status?: number; data?: unknown };
    };
    console.error("[media] uploadMedia:error", {
      message: axiosError?.message,
      status: axiosError?.response?.status,
      data: axiosError?.response?.data,
    });
    throw error;
  }
};

export const uploadExamImage = (file: File, examId?: string) =>
  uploadMedia("exam", file, examId || "draft");

export { IMAGE_COMPRESS };
