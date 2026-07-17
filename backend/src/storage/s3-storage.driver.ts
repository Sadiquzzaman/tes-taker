import { Injectable, Logger, NotImplementedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PutObjectInput,
  StorageDriver,
  StoredObject,
} from './storage.types';

/**
 * Placeholder AWS S3 storage driver.
 *
 * The architecture is ready: wire an S3 SDK client here and implement the
 * four StorageDriver methods. Selecting STORAGE_DRIVER=s3 will then switch
 * all call sites without further refactoring.
 *
 * Required env (documented, not yet consumed):
 *   AWS_S3_BUCKET, AWS_S3_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
 */
@Injectable()
export class S3StorageDriver implements StorageDriver {
  readonly name = 's3' as const;
  private readonly logger = new Logger(S3StorageDriver.name);

  constructor(private readonly configService: ConfigService) {
    // Validate that the expected configuration is present so misconfiguration
    // is caught early, even though the driver is not yet implemented.
    const bucket = this.configService.get<string>('AWS_S3_BUCKET');
    const region = this.configService.get<string>('AWS_S3_REGION');
    if (!bucket || !region) {
      this.logger.warn(
        'S3 storage selected but AWS_S3_BUCKET / AWS_S3_REGION are not fully configured.',
      );
    }
  }

  private notImplemented(method: string): never {
    throw new NotImplementedException(
      `S3 storage driver is not implemented yet (called: ${method}). ` +
        'Set STORAGE_DRIVER=local or implement S3StorageDriver.',
    );
  }

  async put(_input: PutObjectInput): Promise<StoredObject> {
    return this.notImplemented('put');
  }

  async get(_key: string): Promise<Buffer> {
    return this.notImplemented('get');
  }

  async delete(_key: string): Promise<void> {
    return this.notImplemented('delete');
  }

  getPublicUrl(_key: string): string {
    return this.notImplemented('getPublicUrl');
  }
}
