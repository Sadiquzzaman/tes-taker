import {
  BadRequestException,
  Controller,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { randomUUID } from 'crypto';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesEnum } from 'src/common/enums/roles.enum';
import { RolesGuard } from 'src/common/guard/roles.guard';
import { optimizeImageBuffer, withExtension } from './image-optimize.util';
import { StorageService } from './storage.service';

/** Raw upload ceiling — images are compressed afterward. */
const MAX_BYTES = 20 * 1024 * 1024;

const IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const FILE_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]);

/** Known upload namespaces. Extend as new product surfaces need media. */
const UPLOAD_PURPOSES = ['discussion', 'exam', 'image'] as const;
type UploadPurpose = (typeof UPLOAD_PURPOSES)[number];

type UploadedMediaFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

@ApiTags('Uploads')
@ApiBearerAuth('jwt')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(RolesEnum.TEACHER, RolesEnum.STUDENT)
@Controller({ path: 'uploads', version: '1' })
export class UploadController {
  constructor(private readonly storageService: StorageService) {}

  @Post('media')
  @ApiOperation({
    summary: 'Upload media to the configured storage driver (local or S3)',
    description:
      'purpose=discussion allows images + documents; purpose=exam|image is images only. ' +
      'Images are automatically resized/compressed before storage. ' +
      'scopeId namespaces the object key (e.g. classId, examId).',
  })
  @ApiConsumes('multipart/form-data')
  @ApiQuery({
    name: 'purpose',
    required: true,
    enum: UPLOAD_PURPOSES,
  })
  @ApiQuery({
    name: 'scopeId',
    required: false,
    description: 'Optional namespace id (classId, examId, userId, …)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_BYTES },
    }),
  )
  async uploadMedia(
    @UploadedFile() file: UploadedMediaFile | undefined,
    @Query('purpose') purposeRaw: string,
    @Query('scopeId') scopeId?: string,
  ) {
    return this.storeUpload(file, purposeRaw, scopeId);
  }

  @Post('discussion')
  @ApiOperation({
    summary: 'Upload a class discussion / private-chat attachment (alias of purpose=discussion)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiQuery({ name: 'classId', required: true, description: 'Class UUID used to namespace the storage key' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_BYTES },
    }),
  )
  async uploadDiscussionFile(
    @UploadedFile() file: UploadedMediaFile | undefined,
    @Query('classId') classId: string,
  ) {
    if (!classId?.trim()) {
      throw new BadRequestException('classId query parameter is required');
    }
    return this.storeUpload(file, 'discussion', classId.trim());
  }

  private async storeUpload(
    file: UploadedMediaFile | undefined,
    purposeRaw: string,
    scopeId?: string,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const purpose = (purposeRaw || '').trim().toLowerCase() as UploadPurpose;
    if (!UPLOAD_PURPOSES.includes(purpose)) {
      throw new BadRequestException(
        `Invalid purpose. Allowed: ${UPLOAD_PURPOSES.join(', ')}`,
      );
    }

    let mime = (file.mimetype || '').toLowerCase();
    const isImage = IMAGE_MIME.has(mime);
    const isFile = FILE_MIME.has(mime);

    if (purpose === 'discussion') {
      if (!isImage && !isFile) {
        throw new BadRequestException(
          'Unsupported file type. Allowed: jpeg, png, webp, gif, pdf, doc, docx, txt.',
        );
      }
      if (!scopeId?.trim()) {
        throw new BadRequestException('scopeId (classId) is required for discussion uploads');
      }
      // Non-image discussion docs stay under 5 MB.
      if (!isImage && file.size > 5 * 1024 * 1024) {
        throw new BadRequestException('Document size must be 5 MB or less');
      }
    } else if (!isImage) {
      throw new BadRequestException(
        'Unsupported file type. Allowed images: jpeg, png, webp, gif.',
      );
    }

    let body: Buffer = file.buffer;
    let safeName =
      file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'file';

    if (isImage) {
      const optimized = await optimizeImageBuffer(file.buffer, mime);
      if (optimized) {
        body = optimized.buffer;
        mime = optimized.contentType;
        safeName = withExtension(safeName, optimized.extension);
      }
    }

    const scope = (scopeId || 'general').trim().replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
    const folder =
      purpose === 'discussion'
        ? `discussions/${scope}`
        : purpose === 'exam'
          ? `exams/${scope}`
          : `images/${scope}`;
    const key = `${folder}/${randomUUID()}-${safeName}`;

    const stored = await this.storageService.put({
      key,
      body,
      contentType: mime,
    });

    const payload = {
      id: randomUUID(),
      key: stored.key,
      // Private S3 buckets cannot serve virtual-hosted URLs in <img>; use API proxy.
      url: this.storageService.getClientUrl(stored.key),
      file_name: safeName,
      mime_type: mime,
      size: stored.size ?? body.byteLength,
      kind: isImage ? ('image' as const) : ('file' as const),
      purpose,
    };

    return { message: 'File uploaded successfully', payload };
  }
}
