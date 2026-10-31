/**
 * What can be uploaded, for what, and how big (FND-15, design §8.5).
 *
 * HEIC (needs a converter) and PDF optimisation (needs Ghostscript) come later (docs/TODO.md);
 * video follows the resource hub rules (Epic 8), so VIDEO is reserved but not uploadable yet.
 */
export enum FilePurposeEnum {
  EXAM = 'EXAM',
  DISCUSSION = 'DISCUSSION',
  IMAGE = 'IMAGE',
  HOMEWORK = 'HOMEWORK',
  RESOURCE = 'RESOURCE',
  VIDEO = 'VIDEO',
}

export enum FileStatusEnum {
  /** Upload link handed out, or uploaded and waiting for files.process. Counts toward the quota. */
  PENDING = 'PENDING',
  READY = 'READY',
  /** Never uploaded, or processing failed for good. Does not count toward the quota. */
  FAILED = 'FAILED',
}

/** Raw upload ceiling; images get smaller after compression (FND-15). */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
export const DOCUMENT_MIMES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
] as const;

/** Purposes a client may upload for today, with their allowed types. */
export const UPLOAD_RULES: Partial<Record<FilePurposeEnum, readonly string[]>> = {
  [FilePurposeEnum.EXAM]: IMAGE_MIMES,
  [FilePurposeEnum.IMAGE]: IMAGE_MIMES,
  [FilePurposeEnum.DISCUSSION]: [...IMAGE_MIMES, ...DOCUMENT_MIMES],
};

export const isImageMime = (mime: string): boolean => (IMAGE_MIMES as readonly string[]).includes(mime);

/** The groups an owner sees on the storage card (FND-16). */
export type StorageUsageGroup = 'homework' | 'resources' | 'video' | 'other';

export const usageGroupOf = (purpose: string): StorageUsageGroup => {
  switch (purpose) {
    case FilePurposeEnum.HOMEWORK:
      return 'homework';
    case FilePurposeEnum.RESOURCE:
      return 'resources';
    case FilePurposeEnum.VIDEO:
      return 'video';
    default:
      return 'other';
  }
};

/** Share of the quota at which uploads still work but the owner is warned (FND-16). */
export const STORAGE_WARNING_RATIO = 0.9;

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'text/plain': 'txt',
};

export const extensionForMime = (mime: string): string => EXTENSION_BY_MIME[mime] ?? 'bin';
