/** A stored file (FND-15): GET /files/:id, and what an upload returns. */
interface StoredFile {
  id: string;
  purpose: string;
  status: "PENDING" | "READY" | "FAILED";
  mime: string;
  name: string | null;
  /** Counts toward the storage quota; the final (compressed) size once READY. */
  size_bytes: number;
  original_size_bytes: number | null;
  width: number | null;
  height: number | null;
  /** Stable link to the file; store this in content. */
  url: string;
  created_at: string;
}

/** The workspace's storage use against its plan (FND-16): GET /files/usage. */
interface StorageUsage {
  used_bytes: number;
  /** 0 = no limit. */
  limit_bytes: number;
  percent: number;
  /** At 90% or more. */
  warning: boolean;
  /** At 100%: uploads are blocked. */
  full: boolean;
  by_type: { homework: number; resources: number; video: number; other: number };
}

/** POST /files/presign. */
interface PresignedUpload {
  file: StoredFile;
  upload: { url: string; method: "PUT"; headers: Record<string, string> };
  storage: StorageUsage;
}
