/** Client-side image downscale/compress before upload. */

export const IMAGE_COMPRESS = {
  /** Longest edge in px */
  maxEdge: 1920,
  /** JPEG quality 0–1 */
  quality: 0.82,
  /** Accept raw picks up to this size; they are compressed before upload. */
  maxInputBytes: 20 * 1024 * 1024,
} as const;

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export function isCompressibleImage(file: File): boolean {
  return IMAGE_TYPES.has(file.type) || file.type.startsWith("image/");
}

/**
 * Resize (max edge) + JPEG-compress an image File in the browser.
 * Falls back to the original file if compression fails or does not shrink it.
 */
export async function compressImageFile(file: File): Promise<File> {
  if (!isCompressibleImage(file)) {
    return file;
  }

  console.debug("[media] compressImageFile:start", {
    name: file.name,
    type: file.type,
    size: file.size,
  });

  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    const scale = Math.min(1, IMAGE_COMPRESS.maxEdge / Math.max(width, height, 1));
    const targetW = Math.max(1, Math.round(width * scale));
    const targetH = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }

    ctx.drawImage(bitmap, 0, 0, targetW, targetH);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", IMAGE_COMPRESS.quality),
    );

    if (!blob) {
      return file;
    }

    // Keep original when we gained nothing and it was already small.
    if (blob.size >= file.size && file.size <= 120 * 1024) {
      console.debug("[media] compressImageFile:keep-original", { size: file.size });
      return file;
    }

    const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
    const compressed = new File([blob], `${baseName}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });

    console.debug("[media] compressImageFile:done", {
      from: file.size,
      to: compressed.size,
      dimensions: `${width}x${height} → ${targetW}x${targetH}`,
    });

    return compressed;
  } catch (error) {
    console.error("[media] compressImageFile:failed — using original", error);
    return file;
  }
}
