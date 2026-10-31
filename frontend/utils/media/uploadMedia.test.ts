import { beforeEach, describe, expect, it, vi } from "vitest";
import { uploadMedia } from "./uploadMedia";

const apiPost = vi.fn();
const apiGet = vi.fn();
const plainPut = vi.fn();
vi.mock("@/lib/axios", () => ({
  default: { post: (...args: unknown[]) => apiPost(...args), get: (...args: unknown[]) => apiGet(...args) },
}));
vi.mock("axios", () => ({ default: { put: (...args: unknown[]) => plainPut(...args) } }));
// Browser image compression needs a canvas; the upload flow is what is tested here.
vi.mock("@/utils/media/compressImage", () => ({
  IMAGE_COMPRESS: {},
  isCompressibleImage: () => false,
  compressImageFile: (file: File) => Promise.resolve(file),
}));

const stored = (overrides: Partial<StoredFile> = {}): StoredFile => ({
  id: "f-1",
  purpose: "DISCUSSION",
  status: "PENDING",
  mime: "application/pdf",
  name: "notes.pdf",
  size_bytes: 9,
  original_size_bytes: 9,
  width: null,
  height: null,
  url: "https://api.example.test/api/v1/files/f-1/content",
  created_at: "2026-10-31T10:00:00.000Z",
  ...overrides,
});

const presigned: PresignedUpload = {
  file: stored({ original_size_bytes: null }),
  upload: { url: "https://bucket.s3.amazonaws.com/tmp/abc?X-Amz-Signature=1", method: "PUT", headers: { "Content-Type": "application/pdf" } },
  storage: { used_bytes: 0, limit_bytes: 0, percent: 91, warning: true, full: false, by_type: { homework: 0, resources: 0, video: 0, other: 0 } },
};

beforeEach(() => {
  vi.clearAllMocks();
  apiPost.mockImplementation((url: string) =>
    Promise.resolve({ data: { payload: url.endsWith("/files/presign") ? presigned : stored() } }),
  );
  apiGet.mockResolvedValue({ data: { payload: stored({ status: "READY", size_bytes: 7 }) } });
  plainPut.mockImplementation((_url: string, _body: unknown, config: { onUploadProgress: (e: { loaded: number; total: number }) => void }) => {
    config.onUploadProgress({ loaded: 4, total: 9 });
    return Promise.resolve({ status: 200 });
  });
});

describe("uploadMedia (design §8.5)", () => {
  it("asks for a link, sends the file straight to storage with progress, completes and returns the final size", async () => {
    const file = new File(["%PDF-1.4 "], "notes.pdf", { type: "application/pdf" });
    const progress: number[] = [];

    const result = await uploadMedia("discussion", file, " class-1 ", { onProgress: (p) => progress.push(p), waitForReadyMs: 5_000 });

    expect(apiPost.mock.calls[0][0]).toMatch(/\/files\/presign$/);
    expect(apiPost.mock.calls[0][1]).toEqual({ purpose: "DISCUSSION", mime: "application/pdf", size: 9, name: "notes.pdf", scope_id: "class-1" });
    // The signed link gets only its own headers (no Authorization), through plain axios.
    expect(plainPut).toHaveBeenCalledWith(presigned.upload.url, file, expect.objectContaining({ headers: { "Content-Type": "application/pdf" } }));
    expect(progress).toEqual([44, 100]);
    expect(apiPost.mock.calls[1][0]).toMatch(/\/files\/f-1\/complete$/);
    expect(apiGet.mock.calls[0][0]).toMatch(/\/files\/f-1$/);
    expect(result).toEqual({
      id: "f-1",
      key: "f-1",
      url: "https://api.example.test/api/v1/files/f-1/content",
      file_name: "notes.pdf",
      mime_type: "application/pdf",
      size: 7,
      kind: "file",
      purpose: "discussion",
      storage_warning: true,
    });
  });

  it("sends no class for exam images", async () => {
    const file = new File(["x"], "q.png", { type: "image/png" });
    await uploadMedia("exam", file, "draft", { waitForReadyMs: 0 });
    expect(apiPost.mock.calls[0][1]).toEqual({ purpose: "EXAM", mime: "image/png", size: 1, name: "q.png" });
    expect(apiGet).not.toHaveBeenCalled();
  });

  it("stops before uploading when the storage is full", async () => {
    apiPost.mockRejectedValueOnce({ response: { status: 403, data: { code: "PLAN_LIMIT_REACHED", limit: "max_storage_mb" } } });
    await expect(uploadMedia("exam", new File(["x"], "q.png", { type: "image/png" }))).rejects.toMatchObject({ response: { status: 403 } });
    expect(plainPut).not.toHaveBeenCalled();
  });
});
