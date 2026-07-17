/**
 * Storage driver abstraction.
 *
 * The project currently stores files on the local filesystem. This interface
 * (and the accompanying module) is intentionally small so an AWS S3 driver
 * can be added later without refactoring call sites.
 *
 * DO NOT implement S3 here yet — only prepare the architecture.
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
