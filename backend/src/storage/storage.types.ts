/**
 * Storage driver abstraction.
 *
 * Drivers: local filesystem (`STORAGE_DRIVER=local`) or AWS S3 (`STORAGE_DRIVER=s3`).
 * All media uploads (discussions, exam images, generic images) go through StorageService.
 * S3 public URLs use virtual-hosted bucket URLs (no CDN base env).
 */
export type StorageDriverName = 'local' | 's3';

export interface StoredObject {
  /** Stable key used to retrieve / delete the object later. */
  key: string;
  /** Absolute URL or path that clients can use to read the object. */
  url: string;
  /** MIME type when known. */
  contentType?: string;
  /** Size in bytes when known. */
  size?: number;
}

export interface PutObjectInput {
  /** Destination key (path) relative to the storage root / bucket. */
  key: string;
  /** File contents. */
  body: Buffer | Uint8Array | string;
  /** Optional MIME type. */
  contentType?: string;
}

export interface StorageDriver {
  readonly name: StorageDriverName;
  put(input: PutObjectInput): Promise<StoredObject>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  getPublicUrl(key: string): string;
}
