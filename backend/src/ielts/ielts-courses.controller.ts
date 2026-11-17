import { Body, Controller, Delete, ForbiddenException, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';
import { UserPayload } from 'src/common/decorators/user-payload.decorator';
import { BranchScoped } from 'src/common/tenancy/branch-scoped.decorator';
import { Tenant, TenantContext } from 'src/common/tenancy/tenant-context';
import { OrganizationContextGuard } from 'src/organizations/guards/organization-context.guard';
import { FeatureKey } from 'src/subscriptions/constants/feature-catalog';
import { RequiresFeature } from 'src/subscriptions/decorators/requires-feature.decorator';
import { FeatureGuard } from 'src/subscriptions/guards/feature.guard';
import { CreateIeltsCourseDto, ListIeltsCoursesQueryDto, UpdateIeltsCourseDto } from './dto/ielts-course.dto';
import { IeltsCoursesService } from './ielts-courses.service';

const workspace = (): Tenant => {
  const tenant = TenantContext.current();
  if (!tenant) throw new ForbiddenException('Choose your IELTS workspace first');
  return tenant;
};

/**
 * IELTS courses (P12-04, IEL-13). Opened to branch managers (P12-01): the service limits them to
 * their branch. Students of a solo trainer read their courses too. Needs `ielts`.
 */
@ApiTags('IELTS courses')
@ApiBearerAuth('jwt')
@UseGuards(AuthGuard('jwt'), OrganizationContextGuard, FeatureGuard)
@RequiresFeature(FeatureKey.IELTS)
@BranchScoped()
@Controller({ path: 'ielts/courses', version: '1' })
export class IeltsCoursesController {
  constructor(private readonly courses: IeltsCoursesService) {}

  @Get()
  @ApiOperation({ summary: 'Courses: all for owners and admins, the branch for a branch manager, taught ones for a teacher, own for a student' })
  async list(@Query() query: ListIeltsCoursesQueryDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Courses retrieved successfully', payload: await this.courses.list(workspace(), user.id, query) };
  }

  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Course retrieved successfully', payload: await this.courses.get(workspace(), user.id, id) };
  }

  @Post()
  @ApiOperation({ summary: 'A new course: class, own session (the dates), section at the branch with the seat limit, module subject classes and teachers' })
  async create(@Body() dto: CreateIeltsCourseDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Course created', payload: await this.courses.create(workspace(), user, dto) };
  }

  @Patch(':id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateIeltsCourseDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Course saved', payload: await this.courses.update(workspace(), user, id, dto) };
  }

  @Delete(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Remove a course nobody is enrolled in (hidden; history kept)' })
  async remove(@Param('id', ParseUUIDPipe) id: string, @UserPayload() user: JwtPayloadInterface) {
    await this.courses.remove(workspace(), user.id, id);
    return { message: 'Course removed', payload: null };
  }
}
