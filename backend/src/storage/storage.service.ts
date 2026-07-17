import { Inject, Injectable } from '@nestjs/common';
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
}
