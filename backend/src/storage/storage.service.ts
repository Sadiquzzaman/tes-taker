import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PutObjectInput,
  StorageDriver,
  StoredObject,
} from './storage.types';
import { STORAGE_DRIVER } from './storage.constants';

/**
 * Application-facing storage facade.
 *
 * Controllers / services should depend on this class, never on a concrete
 * driver. The active driver is selected at module bootstrap based on
 * STORAGE_DRIVER (local | s3).
 */
@Injectable()
export class StorageService {
  constructor(
    @Inject(STORAGE_DRIVER)
    private readonly driver: StorageDriver,
    private readonly configService: ConfigService,
  ) {}

  get driverName(): string {
    return this.driver.name;
  }

  put(input: PutObjectInput): Promise<StoredObject> {
    return this.driver.put(input);
  }

  get(key: string): Promise<Buffer> {
    return this.driver.get(key);
  }

  delete(key: string): Promise<void> {
    return this.driver.delete(key);
  }

  getPublicUrl(key: string): string {
    return this.driver.getPublicUrl(key);
  }

  /**
   * URL the browser should use to display the object.
   * Local files → `/uploads/...` (static). S3 → API content proxy (bucket is private).
   */
  getClientUrl(key: string): string {
    if (this.driver.name === 's3') {
      const publicBase = (this.configService.get<string>('BACKEND_BASE_URL') || '').replace(
        /\/$/,
        '',
      );
      const path = `/api/v1/uploads/content?key=${encodeURIComponent(key)}`;
      return publicBase ? `${publicBase}${path}` : path;
    }
    return this.toAbsoluteUrl(this.driver.getPublicUrl(key));
  }

  /**
   * Absolute-ize relative `/uploads/...` URLs using BACKEND_BASE_URL when present.
   */
  toAbsoluteUrl(url: string): string {
    if (/^https?:\/\//i.test(url)) {
      return url;
    }
    const publicBase = (this.configService.get<string>('BACKEND_BASE_URL') || '').replace(
      /\/$/,
      '',
    );
    if (url.startsWith('/') && publicBase) {
      return `${publicBase}${url}`;
    }
    return url;
  }
}
