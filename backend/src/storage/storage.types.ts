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

/** Where and how the browser uploads a file straight to storage (design §8.5). */
export interface SignedUpload {
  url: string;
  method: 'PUT';
  /** Headers the upload must send exactly (they are part of the signature). */
  headers: Record<string, string>;
}

export interface ObjectInfo {
  size: number;
  contentType?: string;
}

export interface StorageDriver {
  readonly name: StorageDriverName;
  put(input: PutObjectInput): Promise<StoredObject>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  getPublicUrl(key: string): string;
  /** Size and type of a stored object, or null when it does not exist. */
  head(key: string): Promise<ObjectInfo | null>;
  /** Server-side copy; the source is kept. */
  copy(fromKey: string, toKey: string): Promise<void>;
  /** A short-lived link the browser PUTs the file to. */
  signUpload(key: string, contentType: string, expiresInSeconds: number): Promise<SignedUpload>;
  /** A short-lived link to read the object. */
  signDownload(key: string, expiresInSeconds: number, options?: { contentType?: string; fileName?: string }): Promise<string>;
}
