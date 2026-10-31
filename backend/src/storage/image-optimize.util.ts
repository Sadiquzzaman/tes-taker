import { Logger } from '@nestjs/common';
import * as sharpModule from 'sharp';

// sharp's typings describe its ES module (a default export); under our CommonJS build the
// required module itself is the function.
const sharp = sharpModule as unknown as typeof sharpModule.default;

const logger = new Logger('ImageOptimize');

/** Longest edge after resize (px), FND-15. Larger originals are scaled down; smaller ones are kept. */
export const IMAGE_MAX_EDGE_PX = 1600;
/** WebP quality for stored images (FND-15: "about 80%"). */
export const IMAGE_WEBP_QUALITY = 80;

export type OptimizedImage = {
  buffer: Buffer;
  contentType: string;
  /** Filename extension without the dot, e.g. `webp`. */
  extension: string;
  width: number | null;
  height: number | null;
  originalBytes: number;
  optimizedBytes: number;
};

const IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export function isOptimizableImageMime(mime: string): boolean {
  return IMAGE_MIME.has((mime || '').toLowerCase());
}

/**
 * Resize to at most 1600 px on the long side and save as WebP at quality 80 (FND-15). Runs in the
 * worker's files.process job, never in a request. A GIF becomes a still frame. Returns null for
 * types that are not images; an image that cannot be decoded is returned unchanged.
 */
export async function optimizeImageBuffer(input: Buffer, mime: string): Promise<OptimizedImage | null> {
  if (!isOptimizableImageMime(mime)) {
    return null;
  }

  const originalBytes = input.byteLength;
  try {
    const { data, info } = await sharp(input, { failOn: 'none', animated: false })
      .rotate()
      .resize({
        width: IMAGE_MAX_EDGE_PX,
        height: IMAGE_MAX_EDGE_PX,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: IMAGE_WEBP_QUALITY })
      .toBuffer({ resolveWithObject: true });

    logger.debug(`Optimized image ${originalBytes} B -> ${data.byteLength} B (${info.width}x${info.height} webp)`);
    return {
      buffer: data,
      contentType: 'image/webp',
      extension: 'webp',
      width: info.width,
      height: info.height,
      originalBytes,
      optimizedBytes: data.byteLength,
    };
  } catch (error) {
    logger.warn(`Image optimize failed, storing original: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}
