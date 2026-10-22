import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Query,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { extname } from 'path';
import { StorageService } from './storage.service';

const ALLOWED_KEY_PREFIXES = ['discussions/', 'exams/', 'images/'] as const;

const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.txt': 'text/plain',
};

/**
 * Public read proxy for stored media.
 *
 * The S3 bucket blocks public ACLs, so browser <img> tags cannot load virtual-hosted
 * S3 URLs. This endpoint streams objects through the API (unguessable UUID keys).
 */
@ApiTags('Uploads')
@Controller({ path: 'uploads', version: '1' })
export class UploadContentController {
  constructor(private readonly storageService: StorageService) {}

  @Get('content')
  @ApiOperation({ summary: 'Fetch a stored media object by key (for private S3 buckets)' })
  @ApiQuery({ name: 'key', required: true, description: 'Storage object key' })
  async getContent(@Query('key') keyRaw: string, @Res() res: Response) {
    const key = (keyRaw || '').trim();
    if (!key || key.includes('..') || key.startsWith('/')) {
      throw new BadRequestException('Invalid storage key');
    }
    if (!ALLOWED_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      throw new BadRequestException('Invalid storage key prefix');
    }

    try {
      const body = await this.storageService.get(key);
      const ext = extname(key).toLowerCase();
      const contentType = MIME_BY_EXT[ext] || 'application/octet-stream';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('Content-Length', String(body.byteLength));
      return res.send(body);
    } catch {
      throw new NotFoundException('Media not found');
    }
  }
}
