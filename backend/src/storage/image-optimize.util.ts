import { Logger } from '@nestjs/common';

// sharp is CJS; Nest's CommonJS emit + sharp typings disagree on the callable export.
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const sharp = require('sharp') as any;

const logger = new Logger('ImageOptimize');

/** Longest edge after resize (px). Larger originals are scaled down; smaller ones are kept. */
export const IMAGE_MAX_EDGE_PX = 1920;
/** JPEG quality for stored images (mozjpeg). */
export const IMAGE_JPEG_QUALITY = 80;
/** Skip recompress when the file is already tiny and compression does not shrink it. */
const SKIP_IF_UNDER_BYTES = 120 * 1024;

export type OptimizedImage = {
  buffer: Buffer;
  contentType: string;
  /** Suggested filename extension including the leading dot, e.g. `.jpg`. */
  extension: string;
  originalBytes: number;
  optimizedBytes: number;
};

const IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export function isOptimizableImageMime(mime: string): boolean {
  return IMAGE_MIME.has((mime || '').toLowerCase());
}

/**
 * Downscale + recompress uploaded images before they hit storage.
 * Always outputs JPEG for consistent size/quality (GIF becomes a still frame).
 */
export async function optimizeImageBuffer(
  input: Buffer,
  mime: string,
): Promise<OptimizedImage | null> {
  if (!isOptimizableImageMime(mime)) {
    return null;
  }

  const originalBytes = input.byteLength;

  try {
    const meta = await sharp(input, { failOn: 'none', animated: false }).metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;

    const optimized = await sharp(input, { failOn: 'none', animated: false })
      .rotate()
      .resize({
        width: IMAGE_MAX_EDGE_PX,
        height: IMAGE_MAX_EDGE_PX,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: IMAGE_JPEG_QUALITY, mozjpeg: true })
      .toBuffer();

    // Keep the original when compression did not help and the file is already small.
    if (optimized.byteLength >= originalBytes && originalBytes <= SKIP_IF_UNDER_BYTES) {
      logger.debug(
        `Keeping original image (${originalBytes} B) — already small / no gain from recompress`,
      );
      return {
        buffer: input,
        contentType: mime.toLowerCase(),
        extension: extensionForMime(mime),
        originalBytes,
        optimizedBytes: originalBytes,
      };
    }

    logger.debug(
      `Optimized image ${originalBytes} B → ${optimized.byteLength} B ` +
        `(${width}x${height} → max ${IMAGE_MAX_EDGE_PX}px, jpeg q=${IMAGE_JPEG_QUALITY})`,
    );

    return {
      buffer: optimized,
      contentType: 'image/jpeg',
      extension: '.jpg',
      originalBytes,
      optimizedBytes: optimized.byteLength,
    };
  } catch (error) {
    logger.warn(
      `Image optimize failed, storing original: ${error instanceof Error ? error.message : String(error)}`,
    );
    return {
      buffer: input,
      contentType: mime.toLowerCase(),
      extension: extensionForMime(mime),
      originalBytes,
      optimizedBytes: originalBytes,
    };
  }
}

function extensionForMime(mime: string): string {
  switch (mime.toLowerCase()) {
    case 'image/jpeg':
      return '.jpg';
    case 'image/png':
      return '.png';
    case 'image/webp':
      return '.webp';
    case 'image/gif':
      return '.gif';
    default:
      return '';
  }
}

/** Replace or append a file extension on a safe basename. */
export function withExtension(fileName: string, extension: string): string {
  const base = fileName.replace(/\.[^.]+$/, '') || 'image';
  return `${base}${extension || ''}`;
}
