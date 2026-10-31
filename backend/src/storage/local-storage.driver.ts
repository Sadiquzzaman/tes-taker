import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { copyFile, mkdir, readFile, stat, unlink, writeFile } from 'fs/promises';
import { dirname, join, normalize, resolve } from 'path';
import {
  ObjectInfo,
  PutObjectInput,
  SignedUpload,
  StorageDriver,
  StoredObject,
} from './storage.types';

/** API route that stands in for a presigned S3 PUT when files are stored locally. */
export const LOCAL_UPLOAD_PATH = '/api/v1/files/local-upload';

/**
 * Local-filesystem storage driver.
 *
 * For development and tests only; beta and production use `STORAGE_DRIVER=s3` (S3StorageDriver).
 * Signed uploads go to the API (`PUT /files/local-upload`, HMAC-signed with JWT_SECRET) instead
 * of S3; signed downloads are the static `/uploads/...` path.
 */
@Injectable()
export class LocalStorageDriver implements StorageDriver {
  readonly name = 'local' as const;
  private readonly logger = new Logger(LocalStorageDriver.name);
  private readonly root: string;

  constructor(private readonly configService: ConfigService) {
    const configured = this.configService.get<string>('STORAGE_LOCAL_PATH', './uploads');
    this.root = resolve(configured);
  }

  private resolveKey(key: string): string {
    // Prevent path traversal: the resolved path must stay inside the storage root.
    const absolute = resolve(this.root, normalize(key).replace(/^(\.\.(\/|\\|$))+/, ''));
    if (!absolute.startsWith(this.root)) {
      throw new Error('Invalid storage key');
    }
    return absolute;
  }

  async put(input: PutObjectInput): Promise<StoredObject> {
    const absolute = this.resolveKey(input.key);
    await mkdir(dirname(absolute), { recursive: true });
    const body = typeof input.body === 'string' ? Buffer.from(input.body) : Buffer.from(input.body);
    await writeFile(absolute, body);
    this.logger.debug(`Stored object locally at key=${input.key}`);
    return {
      key: input.key,
      url: this.getPublicUrl(input.key),
      contentType: input.contentType,
      size: body.byteLength,
    };
  }

  async get(key: string): Promise<Buffer> {
    try {
      return await readFile(this.resolveKey(key));
    } catch {
      throw new NotFoundException(`Object not found: ${key}`);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(this.resolveKey(key));
    } catch {
      // Idempotent delete: missing objects are not an error.
    }
  }

  async head(key: string): Promise<ObjectInfo | null> {
    try {
      const info = await stat(this.resolveKey(key));
      return info.isFile() ? { size: info.size } : null;
    } catch {
      return null;
    }
  }

  async copy(fromKey: string, toKey: string): Promise<void> {
    const target = this.resolveKey(toKey);
    await mkdir(dirname(target), { recursive: true });
    try {
      await copyFile(this.resolveKey(fromKey), target);
    } catch {
      throw new NotFoundException(`Object not found: ${fromKey}`);
    }
  }

  async signUpload(key: string, contentType: string, expiresInSeconds: number): Promise<SignedUpload> {
    const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const query = new URLSearchParams({ key, expires: String(expires), signature: this.sign(key, expires) });
    return {
      url: this.absolute(`${LOCAL_UPLOAD_PATH}?${query.toString()}`),
      method: 'PUT',
      headers: { 'Content-Type': contentType },
    };
  }

  /** Checks a link made by `signUpload`. */
  verifyUpload(key: string, expires: number, signature: string): boolean {
    if (!key || !Number.isFinite(expires) || expires < Date.now() / 1000 || !signature) {
      return false;
    }
    const expected = Buffer.from(this.sign(key, expires));
    const given = Buffer.from(signature);
    return expected.length === given.length && timingSafeEqual(expected, given);
  }

  async signDownload(key: string): Promise<string> {
    return this.absolute(this.getPublicUrl(key));
  }

  private sign(key: string, expires: number): string {
    return createHmac('sha256', this.configService.get<string>('JWT_SECRET') ?? '')
      .update(`${key}\n${expires}`)
      .digest('hex');
  }

  private absolute(path: string): string {
    const base = (this.configService.get<string>('BACKEND_BASE_URL') || '').replace(/\/$/, '');
    return base ? `${base}${path}` : path;
  }

  getPublicUrl(key: string): string {
    // Local files are not served by Nest yet. Callers that need a public URL
    // should switch to the S3 driver (or sit a reverse proxy in front of
    // STORAGE_LOCAL_PATH). Returning a relative path keeps the contract stable.
    return join('/uploads', key).replace(/\\/g, '/');
  }
}
