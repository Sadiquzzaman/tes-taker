import axios from "axios";
import axiosReq from "@/lib/axios";
import { compressImageFile, IMAGE_COMPRESS, isCompressibleImage } from "@/utils/media/compressImage";

export type MediaUploadPurpose = "discussion" | "exam" | "image";

export type UploadedMedia = {
  id: string;
  key: string;
  url: string;
  file_name: string;
  mime_type: string;
  /** Final size once the server compressed it (FND-15), otherwise the uploaded size. */
  size: number;
  kind: "image" | "file";
  purpose?: MediaUploadPurpose;
  /** The workspace has used 90% or more of its storage (FND-16). */
  storage_warning?: boolean;
};

export type UploadOptions = {
  /** 0–100 while the file is sent. */
  onProgress?: (percent: number) => void;
  /** How long to wait for the server's compression before returning the uploaded size. */
  waitForReadyMs?: number;
};

const API_BASE = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/$/, "");
const API_ORIGIN = API_BASE.replace(/\/api\/v1\/?$/, "");
const READY_POLL_MS = 1000;

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
    return `${API_BASE}/uploads/content?key=${encodeURIComponent(key)}`;
  }

  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/api/")) return `${API_ORIGIN}${url}`;
  if (url.startsWith("/")) return `${API_ORIGIN}${url}`;
  return url;
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Upload a file (design §8.5): images are compressed in the browser first, then the API checks
 * type, size and the storage quota and hands out a signed link; the file goes straight to
 * storage, and the server compresses it again in the background. A 403 PLAN_LIMIT_REACHED means
 * the workspace's storage is full.
 */
export const uploadMedia = async (
  purpose: MediaUploadPurpose,
  file: File,
  scopeId?: string,
  options: UploadOptions = {},
): Promise<UploadedMedia> => {
  const uploadFile = isCompressibleImage(file) ? await compressImageFile(file) : file;
  const mime = uploadFile.type || file.type;

  const presigned = await axiosReq.post<ApiResponse<PresignedUpload>>(`${API_BASE}/files/presign`, {
    purpose: purpose.toUpperCase(),
    mime,
    size: uploadFile.size,
    name: file.name,
    ...(purpose === "discussion" && scopeId?.trim() ? { scope_id: scopeId.trim() } : {}),
  });
  const { file: created, upload, storage } = presigned.data.payload;

  // Plain axios: the signed link must not get the API's Authorization or workspace headers.
  await axios.put(upload.url, uploadFile, {
    headers: upload.headers,
    onUploadProgress: (event) => {
      if (event.total) options.onProgress?.(Math.round((event.loaded / event.total) * 100));
    },
  });
  options.onProgress?.(100);

  const completed = await axiosReq.post<ApiResponse<StoredFile>>(`${API_BASE}/files/${created.id}/complete`, {});
  let stored = completed.data.payload;

  const deadline = Date.now() + (options.waitForReadyMs ?? 15_000);
  while (stored.status === "PENDING" && Date.now() < deadline) {
    await wait(READY_POLL_MS);
    stored = (await axiosReq.get<ApiResponse<StoredFile>>(`${API_BASE}/files/${created.id}`)).data.payload;
  }

  return {
    id: stored.id,
    key: stored.id,
    url: resolveMediaUrl(stored.url),
    file_name: stored.name ?? file.name,
    mime_type: stored.mime,
    size: stored.size_bytes,
    kind: stored.mime.startsWith("image/") ? "image" : "file",
    purpose,
    storage_warning: storage.warning,
  };
};

export const uploadExamImage = (file: File, examId?: string, options?: UploadOptions) =>
  uploadMedia("exam", file, examId || "draft", options);

export { IMAGE_COMPRESS };
