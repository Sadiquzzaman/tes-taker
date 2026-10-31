import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  PayloadTooLargeException,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';
import { UserPayload } from 'src/common/decorators/user-payload.decorator';
import { OrganizationContextGuard } from 'src/organizations/guards/organization-context.guard';
import { LocalStorageDriver } from 'src/storage/local-storage.driver';
import { StorageService } from 'src/storage/storage.service';
import { CreateUploadDto } from './dto/create-upload.dto';
import { MAX_UPLOAD_BYTES } from './file-rules';
import { DOWNLOAD_LINK_SECONDS, FilesService } from './files.service';

@ApiTags('Files')
@Controller({ path: 'files', version: '1' })
export class FilesController {
  constructor(
    private readonly files: FilesService,
    private readonly storage: StorageService,
    private readonly localDriver: LocalStorageDriver,
  ) {}

  @Post('presign')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), OrganizationContextGuard)
  @ApiOperation({
    summary: 'Step 1 of an upload: check type, size and storage quota, get a link to PUT the file to (FND-15, FND-16)',
    description: 'Over the quota: 403 with code PLAN_LIMIT_REACHED. `storage.warning` is true from 90% use.',
  })
  async presign(@Body() dto: CreateUploadDto, @UserPayload() user: JwtPayloadInterface) {
    const payload = await this.files.createUpload(user, {
      purpose: dto.purpose,
      mime: dto.mime,
      size: dto.size,
      name: dto.name,
      scopeId: dto.scope_id,
    });
    return { message: 'Upload link created', payload };
  }

  @Get('usage')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), OrganizationContextGuard)
  @ApiOperation({ summary: "The current workspace's storage use against its plan, by type (FND-16; owner and admins)" })
  async usage() {
    return { message: 'Storage use retrieved successfully', payload: await this.files.usageForCurrentWorkspace() };
  }

  /** Stands in for a presigned S3 PUT when files are stored locally (development and tests). */
  @Put('local-upload')
  @HttpCode(204)
  @ApiOperation({ summary: 'Local storage only: receive a file sent to a signed upload link' })
  async localUpload(
    @Query('key') key: string,
    @Query('expires') expires: string,
    @Query('signature') signature: string,
    @Req() req: Request,
  ): Promise<void> {
    if (this.storage.driverName !== 'local') {
      throw new NotFoundException();
    }
    if (!this.localDriver.verifyUpload(key, Number(expires), signature)) {
      throw new ForbiddenException('The upload link is invalid or has expired');
    }
    const body = await readBody(req, MAX_UPLOAD_BYTES);
    await this.localDriver.put({ key, body, contentType: req.headers['content-type'] });
  }

  @Post(':id/complete')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), OrganizationContextGuard)
  @ApiOperation({ summary: 'Step 2 of an upload: the file was sent; compress and store it in the background' })
  async complete(@Param('id', ParseUUIDPipe) id: string, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'File uploaded', payload: await this.files.complete(user, id) };
  }

  @Get(':id')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), OrganizationContextGuard)
  @ApiOperation({ summary: 'A file: status, original and final size (another organisation’s file: 404)' })
  async findOne(@Param('id', ParseUUIDPipe) id: string, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'File retrieved successfully', payload: await this.files.getForUser(user, id) };
  }

  @Get(':id/content')
  @ApiOperation({
    summary: 'Open a file: redirects to a signed link valid for 1 hour',
    description: 'Reached by the unguessable file id, so <img> tags work without the login header (like /uploads/content).',
  })
  async content(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response): Promise<void> {
    const { url, ready } = await this.files.contentLink(id);
    // Browsers may reuse the redirect while the signed link is still valid.
    res.setHeader('Cache-Control', ready ? `private, max-age=${DOWNLOAD_LINK_SECONDS - 300}` : 'no-store');
    res.redirect(302, url);
  }

  @Delete(':id')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), OrganizationContextGuard)
  @ApiOperation({ summary: 'Delete a file (soft delete; frees its storage). Uploader, or the workspace owner and admins.' })
  async remove(@Param('id', ParseUUIDPipe) id: string, @UserPayload() user: JwtPayloadInterface) {
    await this.files.remove(user, id);
    return { message: 'File deleted', payload: { id } };
  }
}

/** The raw request body, refusing more than `limit` bytes. */
function readBody(req: Request, limit: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > limit) {
        req.removeAllListeners('data');
        reject(new PayloadTooLargeException('Files can be at most 20 MB'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (total === 0) reject(new BadRequestException('The file is empty'));
      else resolve(Buffer.concat(chunks));
    });
    req.on('error', reject);
  });
}
