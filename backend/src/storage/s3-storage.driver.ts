import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';
import {
  PutObjectInput,
  StorageDriver,
  StoredObject,
} from './storage.types';

/**
 * AWS S3 storage driver for all uploaded media (discussions, exam images, etc.).
 *
 * Required env:
 *   AWS_S3_BUCKET, AWS_S3_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
 *
 * Public object URLs use the virtual-hosted style:
 *   https://{bucket}.s3.{region}.amazonaws.com/{key}
 * Ensure the bucket (or prefix) allows public GetObject for browser display.
 */
@Injectable()
export class S3StorageDriver implements StorageDriver {
  readonly name = 's3' as const;
  private readonly logger = new Logger(S3StorageDriver.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly region: string;

  constructor(private readonly configService: ConfigService) {
    this.bucket = (this.configService.get<string>('AWS_S3_BUCKET') || '').trim();
    this.region = (this.configService.get<string>('AWS_S3_REGION') || '').trim();
    const accessKeyId = (this.configService.get<string>('AWS_ACCESS_KEY_ID') || '').trim();
    const secretAccessKey = (this.configService.get<string>('AWS_SECRET_ACCESS_KEY') || '').trim();

    if (!this.bucket || !this.region) {
      this.logger.warn(
        'S3 storage selected but AWS_S3_BUCKET / AWS_S3_REGION are not fully configured.',
      );
    }

    this.client = new S3Client({
      region: this.region || 'us-east-1',
      credentials:
        accessKeyId && secretAccessKey
          ? { accessKeyId, secretAccessKey }
          : undefined,
    });
  }

  private assertConfigured(): void {
    if (!this.bucket || !this.region) {
      throw new ServiceUnavailableException(
        'S3 storage is not configured. Set AWS_S3_BUCKET and AWS_S3_REGION (and credentials).',
      );
    }
  }

  async put(input: PutObjectInput): Promise<StoredObject> {
    this.assertConfigured();
    const body =
      typeof input.body === 'string' ? Buffer.from(input.body) : Buffer.from(input.body);

    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: input.key,
          Body: body,
          ContentType: input.contentType,
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );
    } catch (error) {
      this.logger.error(
        `Failed to upload to S3 key=${input.key}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new ServiceUnavailableException('Failed to upload file to S3');
    }

    this.logger.debug(`Stored object in S3 bucket=${this.bucket} key=${input.key}`);
    return {
      key: input.key,
      url: this.getPublicUrl(input.key),
      contentType: input.contentType,
      size: body.byteLength,
    };
  }

  async get(key: string): Promise<Buffer> {
    this.assertConfigured();
    try {
      const result = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
      return await this.streamToBuffer(result.Body as Readable | undefined);
    } catch (error) {
      this.logger.warn(
        `S3 get failed for key=${key}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new NotFoundException(`Object not found: ${key}`);
    }
  }

  async delete(key: string): Promise<void> {
    this.assertConfigured();
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
    } catch (error) {
      this.logger.warn(
        `S3 delete failed for key=${key}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  getPublicUrl(key: string): string {
    const encodedKey = key
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');

    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${encodedKey}`;
  }

  private async streamToBuffer(body: Readable | undefined): Promise<Buffer> {
    if (!body) {
      return Buffer.alloc(0);
    }
    const chunks: Buffer[] = [];
    for await (const chunk of body) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
}
