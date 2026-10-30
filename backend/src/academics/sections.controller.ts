import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserPayload } from 'src/common/decorators/user-payload.decorator';
import { RolesEnum } from 'src/common/enums/roles.enum';
import { RolesGuard } from 'src/common/guard/roles.guard';
import { OrganizationContextGuard } from 'src/organizations/guards/organization-context.guard';
import { AcademicAccess } from './academic-access';
import { SectionsService } from './sections.service';
import { EnrolmentsService } from './enrolments.service';
import { EnrolStudentDto, PromoteStudentsDto, UpdateEnrolmentDto } from './dto/enrolment.dto';
import {
  CreateOfferingDto,
  CreateSectionDto,
  ListSectionsQueryDto,
  SetOfferingStudentsDto,
  SetOfferingTeachersDto,
  UpdateOfferingDto,
  UpdateSectionDto,
} from './dto/section.dto';

/** Sections of a class (FND-02), their students (FND-04) and subject classes (FND-19). */
@ApiTags('Sections and subject classes')
@ApiBearerAuth('jwt')
@ApiHeader({ name: 'X-Organization-Id', required: false, description: 'Organisation workspace; empty = your own workspace' })
@UseGuards(AuthGuard('jwt'), RolesGuard, OrganizationContextGuard)
@Roles(RolesEnum.TEACHER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
@Controller({ version: '1' })
export class SectionsController {
  constructor(
    private readonly sections: SectionsService,
    private readonly enrolmentsService: EnrolmentsService,
  ) {}

  @Get('sections')
  @ApiOperation({ summary: 'All sections of the workspace in a session (default session if none given)' })
  async listAll(@Query() query: ListSectionsQueryDto) {
    AcademicAccess.read();
    return { message: 'Sections retrieved successfully', payload: await this.sections.listForSession(query.session_id) };
  }

  @Get('offerings')
  @ApiOperation({ summary: 'All subject classes of the workspace in a session, with their teachers' })
  async listAllOfferings(@Query() query: ListSectionsQueryDto) {
    AcademicAccess.read();
    return { message: 'Subject classes retrieved successfully', payload: await this.sections.listOfferingsForSession(query.session_id) };
  }

  @Get('classes/:classId/sections')
  @ApiOperation({ summary: 'Sections of a class in a session (default session if none given)' })
  async list(@Param('classId', ParseUUIDPipe) classId: string, @Query() query: ListSectionsQueryDto) {
    AcademicAccess.read();
    return { message: 'Sections retrieved successfully', payload: await this.sections.listForClass(classId, query.session_id) };
  }

  @Post('classes/:classId/sections')
  @ApiOperation({ summary: 'Add a section; it gets a subject class for each class subject (Owner/Admin/Assistant)' })
  async create(@Param('classId', ParseUUIDPipe) classId: string, @Body() dto: CreateSectionDto, @UserPayload() user: JwtPayloadInterface) {
    AcademicAccess.manageStructure();
    return { message: 'Section created successfully', payload: await this.sections.createSection(classId, dto, user) };
  }

  @Get('sections/:id')
  @ApiOperation({ summary: 'One section' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    AcademicAccess.read();
    return { message: 'Section retrieved successfully', payload: await this.sections.getSection(id) };
  }

  @Patch('sections/:id')
  @ApiOperation({ summary: 'Rename a section, set its shift, room or class teacher (Owner/Admin/Assistant)' })
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSectionDto, @UserPayload() user: JwtPayloadInterface) {
    AcademicAccess.manageStructure();
    return { message: 'Section updated successfully', payload: await this.sections.updateSection(id, dto, user) };
  }

  @Delete('sections/:id')
  @ApiOperation({ summary: 'Delete an empty section; a class keeps at least one (Owner/Admin/Assistant)' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    AcademicAccess.manageStructure();
    await this.sections.removeSection(id);
    return { message: 'Section deleted successfully' };
  }

  @Get('sections/:id/enrolments')
  @ApiOperation({ summary: 'Students of a section' })
  async enrolments(@Param('id', ParseUUIDPipe) id: string) {
    AcademicAccess.read();
    return { message: 'Students retrieved successfully', payload: await this.sections.listEnrolments(id) };
  }

  @Post('sections/:id/enrolments')
  @ApiOperation({
    summary: 'Enrol a student in this section by account, phone or email (Owner/Admin/Assistant)',
    description: 'One section per class per session. An unknown phone or email becomes an invitation (nothing is sent).',
  })
  async enrol(@Param('id', ParseUUIDPipe) id: string, @Body() dto: EnrolStudentDto, @UserPayload() user: JwtPayloadInterface) {
    AcademicAccess.manageStructure();
    const { enrolment, outcome } = await this.enrolmentsService.enrol(id, dto, user);
    return { message: 'Student enrolled successfully', payload: { ...enrolment, outcome } };
  }

  @Post('sections/:id/promotions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Promote students to a section of another session (Owner/Admin)',
    description:
      'FND-05. Chosen students get an ACTIVE enrolment in the target section; their old one becomes PROMOTED and stays viewable. Students already in the target class for that session are skipped.',
  })
  async promote(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PromoteStudentsDto, @UserPayload() user: JwtPayloadInterface) {
    AcademicAccess.manageSessions();
    return { message: 'Students promoted successfully', payload: await this.enrolmentsService.promote(id, dto, user) };
  }

  @Patch('enrolments/:id')
  @ApiOperation({ summary: 'Move a student to another section, set the roll number, or mark them as left (Owner/Admin/Assistant)' })
  async updateEnrolment(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateEnrolmentDto, @UserPayload() user: JwtPayloadInterface) {
    AcademicAccess.manageStructure();
    return { message: 'Student updated successfully', payload: await this.enrolmentsService.updateFromSection(id, dto, user) };
  }

  @Get('sections/:id/offerings')
  @ApiOperation({ summary: 'Subject classes of a section, with their teachers' })
  async offerings(@Param('id', ParseUUIDPipe) id: string) {
    AcademicAccess.read();
    return { message: 'Subject classes retrieved successfully', payload: await this.sections.listOfferings(id) };
  }

  @Post('sections/:id/offerings')
  @ApiOperation({ summary: 'Teach a subject in this section (Owner/Admin/Assistant)' })
  async createOffering(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateOfferingDto, @UserPayload() user: JwtPayloadInterface) {
    AcademicAccess.manageStructure();
    return { message: 'Subject class created successfully', payload: await this.sections.createOffering(id, dto, user) };
  }

  @Get('offerings/:id')
  @ApiOperation({ summary: 'One subject class' })
  async offering(@Param('id', ParseUUIDPipe) id: string) {
    AcademicAccess.read();
    return { message: 'Subject class retrieved successfully', payload: await this.sections.getOffering(id) };
  }

  @Patch('offerings/:id')
  @ApiOperation({ summary: 'Whole section or selected students; optional subject (Owner/Admin/Assistant)' })
  async updateOffering(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateOfferingDto, @UserPayload() user: JwtPayloadInterface) {
    AcademicAccess.manageStructure();
    return { message: 'Subject class updated successfully', payload: await this.sections.updateOffering(id, dto, user) };
  }

  @Delete('offerings/:id')
  @ApiOperation({ summary: 'Stop teaching a subject in this section (Owner/Admin/Assistant)' })
  async removeOffering(@Param('id', ParseUUIDPipe) id: string) {
    AcademicAccess.manageStructure();
    await this.sections.removeOffering(id);
    return { message: 'Subject class deleted successfully' };
  }

  @Put('offerings/:id/teachers')
  @ApiOperation({ summary: 'Set the teachers of a subject class (Owner/Admin/Assistant)' })
  async setTeachers(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetOfferingTeachersDto, @UserPayload() user: JwtPayloadInterface) {
    AcademicAccess.manageStructure();
    return { message: 'Teachers updated successfully', payload: await this.sections.setTeachers(id, dto, user) };
  }

  @Put('offerings/:id/students')
  @ApiOperation({ summary: 'Pick the students of an optional subject (Owner/Admin/Assistant)' })
  async setStudents(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetOfferingStudentsDto, @UserPayload() user: JwtPayloadInterface) {
    AcademicAccess.manageStructure();
    return { message: 'Students updated successfully', payload: await this.sections.setStudents(id, dto, user) };
  }

  @Get('offerings/:id/roster')
  @ApiOperation({ summary: 'Students who take this subject class' })
  async roster(@Param('id', ParseUUIDPipe) id: string) {
    AcademicAccess.read();
    return { message: 'Students retrieved successfully', payload: await this.sections.rosterOf(id) };
  }
}
