import { Body, Controller, Delete, ForbiddenException, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';
import { UserPayload } from 'src/common/decorators/user-payload.decorator';
import { Tenant, TenantContext } from 'src/common/tenancy/tenant-context';
import { OrganizationContextGuard } from 'src/organizations/guards/organization-context.guard';
import { FeatureKey } from 'src/subscriptions/constants/feature-catalog';
import { RequiresFeature } from 'src/subscriptions/decorators/requires-feature.decorator';
import { FeatureGuard } from 'src/subscriptions/guards/feature.guard';
import { CreateOfflineExamDto, ListOfflineExamsQueryDto, SaveOfflineMarksDto, UpdateOfflineExamDto } from './dto/offline-exam.dto';
import { OfflineExamsService } from './offline-exams.service';

const workspace = (): Tenant => {
  const tenant = TenantContext.current();
  if (!tenant) throw new ForbiddenException('Choose a workspace first');
  return tenant;
};

/** Exams taken on paper and their marks (P7-01, PRF-03). Needs the `performance` feature. */
@ApiTags('Paper exams')
@ApiBearerAuth('jwt')
@ApiHeader({ name: 'X-Organization-Id', required: false, description: 'Organisation workspace; empty = your own workspace' })
@UseGuards(AuthGuard('jwt'), OrganizationContextGuard, FeatureGuard)
@RequiresFeature(FeatureKey.PERFORMANCE)
@Controller({ path: 'offline-exams', version: '1' })
export class OfflineExamsController {
  constructor(private readonly exams: OfflineExamsService) {}

  @Get()
  @ApiOperation({ summary: 'Paper exams the caller manages (staff; a teacher those of subject classes they teach)' })
  async list(@Query() query: ListOfflineExamsQueryDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Paper exams retrieved successfully', payload: await this.exams.list(workspace(), user.id, query) };
  }

  @Get('subject-classes')
  @ApiOperation({ summary: 'Subject classes the caller may add paper exams to, with their terms' })
  async subjectClasses(@UserPayload() user: JwtPayloadInterface) {
    return { message: 'Subject classes retrieved successfully', payload: await this.exams.subjectClasses(workspace(), user.id) };
  }

  @Get('mine')
  @ApiOperation({ summary: "The caller's published paper-exam results (students)" })
  async mine(@UserPayload() user: JwtPayloadInterface) {
    return { message: 'Results retrieved successfully', payload: await this.exams.mine(workspace(), user.id) };
  }

  @Post()
  @ApiOperation({ summary: 'Create a paper exam for a subject class, with its date, total and optional parts' })
  async create(@Body() dto: CreateOfflineExamDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Paper exam created', payload: await this.exams.create(workspace(), user, dto) };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Change a paper exam (marks already entered must fit a new total)' })
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateOfflineExamDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Paper exam saved', payload: await this.exams.update(workspace(), user, id, dto) };
  }

  @Delete(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Remove a paper exam (kept with who and when; its marks stop counting)' })
  async remove(@Param('id', ParseUUIDPipe) id: string, @UserPayload() user: JwtPayloadInterface) {
    await this.exams.remove(workspace(), user, id);
    return { message: 'Paper exam removed', payload: null };
  }

  @Get(':id/marks')
  @ApiOperation({ summary: 'The marks grid: everyone taking the subject class with their marks' })
  async grid(@Param('id', ParseUUIDPipe) id: string, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Marks retrieved successfully', payload: await this.exams.grid(workspace(), user.id, id) };
  }

  @Put(':id/marks')
  @ApiOperation({ summary: 'Save marks (or absent) for one or many students; every change is in the audit log' })
  async saveMarks(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SaveOfflineMarksDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Marks saved', payload: await this.exams.saveMarks(workspace(), user, id, dto.rows) };
  }

  @Post(':id/publish')
  @HttpCode(200)
  @ApiOperation({ summary: 'Publish the marks: students see them from now on' })
  async publish(@Param('id', ParseUUIDPipe) id: string, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Marks published', payload: await this.exams.publish(workspace(), user, id) };
  }
}
