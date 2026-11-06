import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';
import { UserPayload } from 'src/common/decorators/user-payload.decorator';
import { OrganizationContextGuard } from 'src/organizations/guards/organization-context.guard';
import { FeatureKey } from 'src/subscriptions/constants/feature-catalog';
import { RequiresFeature } from 'src/subscriptions/decorators/requires-feature.decorator';
import { FeatureGuard } from 'src/subscriptions/guards/feature.guard';
import { requireWorkspace } from './attendance-access';
import { PaperRegisterImportDto, RegisterMonthQueryDto } from './dto/paper-register.dto';
import { PaperRegisterService } from './paper-register.service';

/**
 * The monthly register of a section (ATT-17, ATT-13): the template and the export (one row per
 * student, one column per class day), and the paper register import with its check. Staff who see
 * the section's classes (owners, admins and assistants every section; a teacher the sections they
 * teach). Only paper-register sections take an import. Errors carry a `code`
 * (ATTENDANCE_REGISTER_*). Needs `attendance`.
 */
@ApiTags('Attendance')
@ApiBearerAuth('jwt')
@ApiHeader({ name: 'X-Organization-Id', required: false, description: 'Organisation workspace; empty = your own workspace' })
@UseGuards(AuthGuard('jwt'), OrganizationContextGuard, FeatureGuard)
@RequiresFeature(FeatureKey.ATTENDANCE)
@Controller({ path: 'attendance/register', version: '1' })
export class PaperRegisterController {
  constructor(private readonly register: PaperRegisterService) {}

  @Get('sections')
  @ApiOperation({ summary: 'The sections whose register the caller may download, with their attendance mode' })
  async sections(@UserPayload() user: JwtPayloadInterface) {
    return { message: 'Sections retrieved successfully', payload: await this.register.sectionList(requireWorkspace(), user.id) };
  }

  @Get('sections/:id')
  @ApiOperation({
    summary: "A section's register for a month: its class days and each student's marks",
    description: 'The template (marks left empty) and the CSV export use the same columns: roll number, name, one per class day.',
  })
  async month(@Param('id', ParseUUIDPipe) id: string, @Query() query: RegisterMonthQueryDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Register retrieved successfully', payload: await this.register.register(requireWorkspace(), user.id, id, query.month) };
  }

  @Post('sections/:id/preview')
  @HttpCode(200)
  @ApiOperation({ summary: 'Check a paper register CSV (header and lines as JSON): problems per column, row and cell; nothing is saved' })
  async preview(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PaperRegisterImportDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Register checked', payload: await this.register.preview(requireWorkspace(), user.id, id, dto) };
  }

  @Post('sections/:id/import')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Import a paper register CSV (all or nothing; the same file twice changes nothing)',
    description:
      '400 ATTENDANCE_REGISTER_INVALID while anything has a problem; 409 ATTENDANCE_REGISTER_SELF_CHECKIN for a self check-in section. Changes are corrections with a trail; approved leave is kept; self check-ins are kept unless overwrite_check_ins.',
  })
  async import(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PaperRegisterImportDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Register imported', payload: await this.register.import(requireWorkspace(), user.id, id, dto) };
  }
}
