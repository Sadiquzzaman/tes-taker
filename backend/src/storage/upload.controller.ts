import {
  BadRequestException,
  Controller,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
import { StorageService } from './storage.service';

const MAX_BYTES = 5 * 1024 * 1024;

const IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const FILE_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]);

type UploadedDiscussionFile = {
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
  constructor(
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
  ) {}

  @Post('discussion')
  @ApiOperation({ summary: 'Upload an image or file for class discussions / private chat' })
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
    @UploadedFile() file: UploadedDiscussionFile | undefined,
    @Query('classId') classId: string,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    if (!classId?.trim()) {
      throw new BadRequestException('classId query parameter is required');
    }

    const mime = (file.mimetype || '').toLowerCase();
    const isImage = IMAGE_MIME.has(mime);
    const isFile = FILE_MIME.has(mime);
    if (!isImage && !isFile) {
      throw new BadRequestException(
        'Unsupported file type. Allowed: jpeg, png, webp, gif, pdf, doc, docx, txt.',
      );
    }

    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'file';
    const key = `discussions/${classId.trim()}/${randomUUID()}-${safeName}`;
    const stored = await this.storageService.put({
      key,
      body: file.buffer,
      contentType: mime,
    });

    // S3 returns an absolute https URL; local driver returns /uploads/...
    const publicBase = (this.configService.get<string>('BACKEND_BASE_URL') || '').replace(/\/$/, '');
    const url = /^https?:\/\//i.test(stored.url)
      ? stored.url
      : publicBase
        ? `${publicBase}${stored.url}`
        : stored.url;

    const payload = {
      id: randomUUID(),
      key: stored.key,
      url,
      file_name: file.originalname || safeName,
      mime_type: mime,
      size: stored.size ?? file.size,
      kind: isImage ? ('image' as const) : ('file' as const),
    };

    return { message: 'File uploaded successfully', payload };
  }
}
