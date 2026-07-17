import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import { dirname, join, normalize, resolve } from 'path';
import {
  PutObjectInput,
  StorageDriver,
  StoredObject,
} from './storage.types';

/**
 * Local-filesystem storage driver.
 *
 * Suitable for single-server deployments. Swap for an S3 driver later by
 * implementing the same StorageDriver interface.
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

  getPublicUrl(key: string): string {
    // Local files are not served by Nest yet. Callers that need a public URL
    // should switch to the S3 driver (or sit a reverse proxy in front of
    // STORAGE_LOCAL_PATH). Returning a relative path keeps the contract stable.
    return join('/uploads', key).replace(/\\/g, '/');
  }
}
