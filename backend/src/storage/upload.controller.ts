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
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserPayload } from 'src/common/decorators/user-payload.decorator';
import { RolesEnum } from 'src/common/enums/roles.enum';
import { RolesGuard } from 'src/common/guard/roles.guard';
import { isImageMime, MAX_UPLOAD_BYTES as MAX_BYTES } from 'src/files/file-rules';
import { FilesService } from 'src/files/files.service';
import { OrganizationContextGuard } from 'src/organizations/guards/organization-context.guard';

/** Known upload namespaces. Extend as new product surfaces need media. */
const UPLOAD_PURPOSES = ['discussion', 'exam', 'image'] as const;
type UploadPurpose = (typeof UPLOAD_PURPOSES)[number];

type UploadedMediaFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

/**
 * The older multipart uploads. They go through FilesService like presigned uploads (type, size,
 * storage quota, a file_objects row, compression in the worker) and return the stable
 * /files/{id}/content link. The web app uses POST /files/presign instead.
 */
@ApiTags('Uploads')
@ApiBearerAuth('jwt')
@UseGuards(AuthGuard('jwt'), RolesGuard, OrganizationContextGuard)
@Roles(RolesEnum.TEACHER, RolesEnum.STUDENT)
@Controller({ path: 'uploads', version: '1' })
export class UploadController {
  constructor(private readonly files: FilesService) {}

  @Post('media')
  @ApiOperation({
    summary: 'Upload media to the configured storage driver (local or S3)',
    description:
      'purpose=discussion allows images + documents; purpose=exam|image is images only. ' +
      'Counts toward the storage quota; images are compressed in the background (FND-15). ' +
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
    @UserPayload() user: JwtPayloadInterface,
    @Query('scopeId') scopeId?: string,
  ) {
    return this.storeUpload(user, file, purposeRaw, scopeId);
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
    @UserPayload() user: JwtPayloadInterface,
  ) {
    if (!classId?.trim()) {
      throw new BadRequestException('classId query parameter is required');
    }
    return this.storeUpload(user, file, 'discussion', classId.trim());
  }

  private async storeUpload(
    user: JwtPayloadInterface,
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

    const mime = (file.mimetype || '').toLowerCase();
    const stored = await this.files.uploadBuffer(
      user,
      { purpose, mime, name: file.originalname, scopeId: scopeId?.trim() },
      file.buffer,
    );

    const payload = {
      id: stored.id,
      key: stored.id,
      url: stored.url,
      file_name: stored.name ?? 'file',
      mime_type: stored.mime,
      size: stored.size_bytes,
      kind: isImageMime(stored.mime) ? ('image' as const) : ('file' as const),
      purpose,
      status: stored.status,
    };

    return { message: 'File uploaded successfully', payload };
  }
}
