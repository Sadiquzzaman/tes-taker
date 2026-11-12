import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';
import { UserPayload } from 'src/common/decorators/user-payload.decorator';
import { OrganizationContextGuard } from 'src/organizations/guards/organization-context.guard';
import { FeatureKey } from 'src/subscriptions/constants/feature-catalog';
import { RequiresFeature } from 'src/subscriptions/decorators/requires-feature.decorator';
import { FeatureGuard } from 'src/subscriptions/guards/feature.guard';
import { ATTENDANCE_STAFF, requireAttendanceRole } from './attendance-access';
import { ScheduleImportDto } from './dto/schedule-import.dto';
import { ApplyScheduleDto, ReplaceSlotsDto, SetupQueryDto, UpdateSectionSetupDto } from './dto/section-setup.dto';
import { ScheduleImportService } from './schedule-import.service';
import { SectionSetupService } from './section-setup.service';

const STAFF_ONLY = 'Only staff can see the class setup';

/**
 * Class setup (ATT-16): each section's branch, in person / online, attendance mode, grace period and
 * weekly schedule. Staff read the grid; owners, admins and assistants change every section, a
 * teacher the sections they teach. Errors carry a `code` (ATTENDANCE_*, SCHEDULE_*). Needs `attendance`.
 */
@ApiTags('Attendance')
@ApiBearerAuth('jwt')
@ApiHeader({ name: 'X-Organization-Id', required: false, description: 'Organisation workspace; empty = your own workspace' })
@UseGuards(AuthGuard('jwt'), OrganizationContextGuard, FeatureGuard)
@RequiresFeature(FeatureKey.ATTENDANCE)
@Controller({ path: 'attendance/setup', version: '1' })
export class SectionSetupController {
  constructor(
    private readonly setup: SectionSetupService,
    private readonly imports: ScheduleImportService,
  ) {}

  @Get()
  @ApiOperation({ summary: "The setup grid: every section of a session (default: the organisation's default session)" })
  async grid(@Query() query: SetupQueryDto, @UserPayload() user: JwtPayloadInterface) {
    const tenant = requireAttendanceRole(ATTENDANCE_STAFF, STAFF_ONLY);
    return { message: 'Class setup retrieved successfully', payload: await this.setup.grid(tenant, user.id, query.session_id) };
  }

  @Patch('sections/:id')
  @ApiOperation({ summary: "Change a section's branch, class type, attendance mode or grace period" })
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSectionSetupDto, @UserPayload() user: JwtPayloadInterface) {
    const tenant = requireAttendanceRole(ATTENDANCE_STAFF, STAFF_ONLY);
    return { message: 'Section setup saved', payload: await this.setup.updateSection(tenant, user.id, id, dto) };
  }

  @Put('sections/:id/slots')
  @ApiOperation({ summary: "Replace a section's weekly schedule (an empty list clears it); removed slots are kept as history" })
  async replaceSlots(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReplaceSlotsDto, @UserPayload() user: JwtPayloadInterface) {
    const tenant = requireAttendanceRole(ATTENDANCE_STAFF, STAFF_ONLY);
    return { message: 'Schedule saved', payload: await this.setup.replaceSlots(tenant, user.id, id, dto.slots) };
  }

  @Post('apply')
  @HttpCode(200)
  @ApiOperation({
    summary: "Apply a section's schedule to every other section of a class or shift (Owner/Admin/Assistant)",
    description: 'With `dry_run: true` only lists the sections that would be replaced. Teachers are not copied; `include_settings` also copies class type, mode and grace period.',
  })
  async apply(@Body() dto: ApplyScheduleDto, @UserPayload() user: JwtPayloadInterface) {
    const tenant = requireAttendanceRole(ATTENDANCE_STAFF, STAFF_ONLY);
    const payload = await this.setup.apply(tenant, user.id, dto);
    return { message: dto.dry_run ? 'Sections to change' : 'Schedule applied', payload };
  }

  @Post('import/preview')
  @HttpCode(200)
  @ApiOperation({ summary: 'Check a schedule CSV (rows as JSON): problems per row and what each section will get; nothing is saved' })
  async importPreview(@Body() dto: ScheduleImportDto, @UserPayload() user: JwtPayloadInterface) {
    const tenant = requireAttendanceRole(ATTENDANCE_STAFF, STAFF_ONLY);
    return { message: 'Schedule file checked', payload: await this.imports.preview(tenant, user.id, dto) };
  }

  @Post('import')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Import a schedule CSV: each section in the file gets exactly its listed times (all or nothing)',
    description: '400 ATTENDANCE_SCHEDULE_IMPORT_INVALID while any row has a problem; check with import/preview first.',
  })
  async import(@Body() dto: ScheduleImportDto, @UserPayload() user: JwtPayloadInterface) {
    const tenant = requireAttendanceRole(ATTENDANCE_STAFF, STAFF_ONLY);
    return { message: 'Schedule imported', payload: await this.imports.import(tenant, user.id, dto) };
  }
}
