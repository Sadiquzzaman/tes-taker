import { Body, Controller, Delete, ForbiddenException, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';
import { UserPayload } from 'src/common/decorators/user-payload.decorator';
import { Tenant, TenantContext } from 'src/common/tenancy/tenant-context';
import { OrganizationContextGuard } from 'src/organizations/guards/organization-context.guard';
import { FeatureKey } from 'src/subscriptions/constants/feature-catalog';
import { RequiresFeature } from 'src/subscriptions/decorators/requires-feature.decorator';
import { FeatureGuard } from 'src/subscriptions/guards/feature.guard';
import { CreateResourceDto, FolderDto, ListResourcesQueryDto, UpdateResourceDto } from './dto/resource.dto';
import { ResourcesService } from './resources.service';

const workspace = (): Tenant => {
  const tenant = TenantContext.current();
  if (!tenant || tenant.viaEnrolment) throw new ForbiddenException('Choose a school workspace first');
  return tenant;
};

/**
 * The resource library (Epic 8, P9-03: RES-01, RES-03 to RES-06). Staff add files and links and
 * share them with subject classes; students see what is shared with them. Errors carry a `code`
 * (RESOURCE_*). Needs `resources`.
 */
@ApiTags('Resources')
@ApiBearerAuth('jwt')
@ApiHeader({ name: 'X-Organization-Id', required: false, description: 'Organisation workspace' })
@UseGuards(AuthGuard('jwt'), OrganizationContextGuard, FeatureGuard)
@RequiresFeature(FeatureKey.RESOURCES)
@Controller({ path: 'resources', version: '1' })
export class ResourcesController {
  constructor(private readonly resources: ResourcesService) {}

  @Get()
  @ApiOperation({ summary: 'Staff: your resources and the ones shared with subject classes you teach (owners, admins, staff: all); filters q, subject_id, folder_id (or none), type, archived' })
  async list(@Query() query: ListResourcesQueryDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Resources retrieved successfully', payload: await this.resources.list(workspace(), user.id, query) };
  }

  @Get('mine')
  @ApiOperation({ summary: 'Students: resources shared with your subject classes, newest first, with is_new until opened' })
  async mine(@Query() query: ListResourcesQueryDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Resources retrieved successfully', payload: await this.resources.mine(workspace(), user.id, query) };
  }

  @Get('subject-classes')
  @ApiOperation({ summary: 'The subject classes you may share with' })
  async shareOptions(@UserPayload() user: JwtPayloadInterface) {
    return { message: 'Subject classes retrieved successfully', payload: await this.resources.shareOptions(workspace(), user.id) };
  }

  @Get('folders')
  @ApiOperation({ summary: 'Your folders' })
  async folders(@UserPayload() user: JwtPayloadInterface) {
    return { message: 'Folders retrieved successfully', payload: await this.resources.listFolders(workspace(), user.id) };
  }

  @Post('folders')
  @ApiOperation({ summary: 'Add a folder' })
  async createFolder(@Body() dto: FolderDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Folder added', payload: await this.resources.createFolder(workspace(), user.id, dto.name) };
  }

  @Patch('folders/:id')
  @ApiOperation({ summary: 'Rename a folder' })
  async renameFolder(@Param('id', ParseUUIDPipe) id: string, @Body() dto: FolderDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Folder renamed', payload: await this.resources.renameFolder(workspace(), user.id, id, dto.name) };
  }

  @Delete('folders/:id')
  @ApiOperation({ summary: 'Delete a folder (kept as deleted); its resources move out of it' })
  async removeFolder(@Param('id', ParseUUIDPipe) id: string, @UserPayload() user: JwtPayloadInterface) {
    await this.resources.removeFolder(workspace(), user.id, id);
    return { message: 'Folder deleted', payload: null };
  }

  @Post()
  @ApiOperation({ summary: 'Add a file (an upload with purpose RESOURCE) or a link, and share it with subject classes' })
  async create(@Body() dto: CreateResourceDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Resource added', payload: await this.resources.create(workspace(), user.id, dto) };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Rename, describe, move, tag, archive, change download or sharing (whoever added it; owners, admins, staff)' })
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateResourceDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Resource saved', payload: await this.resources.update(workspace(), user.id, id, dto) };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a resource (kept as deleted; students stop seeing it)' })
  async remove(@Param('id', ParseUUIDPipe) id: string, @UserPayload() user: JwtPayloadInterface) {
    await this.resources.remove(workspace(), user.id, id);
    return { message: 'Resource deleted', payload: null };
  }

  @Get(':id/insights')
  @ApiOperation({ summary: 'Who opened it and who has not (students of the subject classes it is shared with)' })
  async insights(@Param('id', ParseUUIDPipe) id: string, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Insights retrieved successfully', payload: await this.resources.insights(workspace(), user.id, id) };
  }

  @Post(':id/open')
  @HttpCode(200)
  @ApiOperation({ summary: 'Students: open a resource shared with you (recorded); returns where it is' })
  async open(@Param('id', ParseUUIDPipe) id: string, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Resource opened', payload: await this.resources.open(workspace(), user.id, id) };
  }
}
