import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { OptionalJwtAuthGuard } from 'src/auth/guards/optional-jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesEnum } from 'src/common/enums/roles.enum';
import { UserPayload } from 'src/common/decorators/user-payload.decorator';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';
import { ClassService } from './class.service';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto, AddStudentsToClassDto, RemoveStudentsFromClassDto } from './dto/update-class.dto';
import { AddStudentsBulkDto } from './dto/add-students-bulk.dto';
import { AssignClassTeacherDto } from './dto/assign-class-teacher.dto';
import { AddClassSubjectDto } from './dto/add-class-subject.dto';
import { AssignClassSubjectTeacherDto } from './dto/assign-class-subject-teacher.dto';
import { UpdateClassSubjectTeacherDto } from './dto/update-class-subject-teacher.dto';
import { OrganizationContextGuard } from 'src/organizations/guards/organization-context.guard';
import { OrgContext } from 'src/organizations/decorators/org-context.decorator';
import { OrgContext as OrgContextType } from 'src/organizations/interfaces/org-context.interface';

@ApiTags('Classes')
@ApiHeader({
  name: 'X-Organization-Id',
  required: false,
  description: 'Organization workspace context. Empty = individual teacher workspace.',
})
@Controller({
  path: 'classes',
  version: '1',
})
export class ClassController {
  constructor(private readonly classService: ClassService) {}

  @Post()
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard, OrganizationContextGuard)
  @Roles(RolesEnum.TEACHER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Create a new class',
    description:
      'Teachers can create classes and optionally assign students during creation. With X-Organization-Id, creates an ORGANIZATION class.',
  })
  @ApiResponse({ status: 201, description: 'Class created successfully' })
  async create(
    @Body() dto: CreateClassDto,
    @UserPayload() jwtPayload: JwtPayloadInterface,
    @OrgContext() orgContext: OrgContextType | null,
  ) {
    const result = await this.classService.create(dto, jwtPayload, orgContext);
    return {
      message: 'Class created successfully',
      payload: result.class,
      studentResults: result.studentResults,
    };
  }

  @Get()
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard, OrganizationContextGuard)
  @Roles(RolesEnum.TEACHER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Get all classes for the logged-in teacher',
    description:
      'Returns classes for the current workspace (organization or individual). Does not merge org and personal classes.',
  })
  @ApiResponse({ status: 200, description: 'List of classes' })
  async findAll(
    @UserPayload() jwtPayload: JwtPayloadInterface,
    @OrgContext() orgContext: OrgContextType | null,
  ) {
    const payload = await this.classService.findAll(jwtPayload, orgContext);
    return { message: 'Classes retrieved successfully', payload };
  }

  @Post(':id/join')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.STUDENT)
  @ApiOperation({
    summary: 'Join class by class id',
    description:
      'Authenticated verified student joins using the class UUID. If joining an organization class, a STUDENT organization membership is upserted.',
  })
  @ApiParam({ name: 'id', description: 'Class UUID' })
  async joinClassById(
    @Param('id', ParseUUIDPipe) id: string,
    @UserPayload() jwtPayload: JwtPayloadInterface,
  ) {
    const payload = await this.classService.joinClassByClassId(id, jwtPayload.id);
    const msg =
      payload.status === 'PENDING'
        ? 'Join request submitted. Waiting for teacher approval.'
        : 'Successfully joined the class.';
    return { message: msg, payload };
  }

  @Get('search-students')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.TEACHER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @ApiOperation({ summary: 'Search students by name, email, or phone' })
  @ApiQuery({ name: 'query', required: true, description: 'Search query (min 2 characters)' })
  async searchStudents(@Query('query') query: string) {
    const payload = await this.classService.searchStudents(query);
    return { message: 'Students retrieved successfully', payload };
  }

  @Get(':id/teachers')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard, OrganizationContextGuard)
  @Roles(RolesEnum.TEACHER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @ApiOperation({ summary: 'List teachers assigned to a class' })
  @ApiParam({ name: 'id', description: 'Class UUID' })
  async listClassTeachers(
    @Param('id', ParseUUIDPipe) id: string,
    @UserPayload() jwtPayload: JwtPayloadInterface,
    @OrgContext() orgContext: OrgContextType | null,
  ) {
    const payload = await this.classService.listClassTeachers(id, jwtPayload, orgContext);
    return { message: 'Class teachers retrieved successfully', payload };
  }

  @Post(':id/teachers')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard, OrganizationContextGuard)
  @Roles(RolesEnum.TEACHER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @ApiOperation({ summary: 'Assign a teacher to a class' })
  @ApiParam({ name: 'id', description: 'Class UUID' })
  async assignClassTeacher(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignClassTeacherDto,
    @UserPayload() jwtPayload: JwtPayloadInterface,
    @OrgContext() orgContext: OrgContextType | null,
  ) {
    const payload = await this.classService.assignClassTeacher(
      id,
      dto.teacher_id,
      dto.subject_id,
      jwtPayload,
      orgContext,
    );
    return { message: 'Class teacher assigned successfully', payload };
  }

  @Delete(':id/teachers/:classTeacherId')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard, OrganizationContextGuard)
  @Roles(RolesEnum.TEACHER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @ApiOperation({ summary: 'Remove a class teacher assignment' })
  async removeClassTeacher(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('classTeacherId', ParseUUIDPipe) classTeacherId: string,
    @UserPayload() jwtPayload: JwtPayloadInterface,
    @OrgContext() orgContext: OrgContextType | null,
  ) {
    await this.classService.removeClassTeacher(id, classTeacherId, jwtPayload, orgContext);
    return { message: 'Class teacher removed successfully', payload: null };
  }

  @Get(':id')
  @ApiBearerAuth('jwt')
  @UseGuards(OptionalJwtAuthGuard, OrganizationContextGuard)
  @ApiOperation({
    summary: 'Get a specific class by ID',
    description:
      'With a valid Bearer token (teacher/admin): full class details. Without a token: public summary.',
  })
  @ApiParam({ name: 'id', description: 'Class UUID' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @UserPayload() jwtPayload?: JwtPayloadInterface,
    @OrgContext() orgContext?: OrgContextType | null,
  ) {
    const payload = jwtPayload
      ? await this.classService.findOne(id, jwtPayload, orgContext)
      : await this.classService.findOne(id);
    return { message: 'Class retrieved successfully', payload };
  }

  @Patch(':id')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard, OrganizationContextGuard)
  @Roles(RolesEnum.TEACHER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update a class' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClassDto,
    @UserPayload() jwtPayload: JwtPayloadInterface,
    @OrgContext() orgContext: OrgContextType | null,
  ) {
    const payload = await this.classService.update(id, dto, jwtPayload, orgContext);
    return { message: 'Class updated successfully', payload };
  }

  @Delete(':id')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard, OrganizationContextGuard)
  @Roles(RolesEnum.TEACHER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete a class' })
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @UserPayload() jwtPayload: JwtPayloadInterface,
    @OrgContext() orgContext: OrgContextType | null,
  ) {
    await this.classService.delete(id, jwtPayload, orgContext);
    return { message: 'Class deleted successfully' };
  }

  @Post(':id/students')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard, OrganizationContextGuard)
  @Roles(RolesEnum.TEACHER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @ApiOperation({ summary: 'Add students to a class' })
  async addStudents(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddStudentsToClassDto,
    @UserPayload() jwtPayload: JwtPayloadInterface,
    @OrgContext() orgContext: OrgContextType | null,
  ) {
    const studentResults = await this.classService.addStudentsByPhoneOrEmail(
      id,
      dto.students,
      jwtPayload,
      orgContext,
    );
    const classEntity = await this.classService.findOne(id, jwtPayload, orgContext);
    return {
      message: 'Students processed successfully',
      payload: classEntity,
      studentResults,
    };
  }

  @Delete(':id/students')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard, OrganizationContextGuard)
  @Roles(RolesEnum.TEACHER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @ApiOperation({ summary: 'Remove students from a class' })
  async removeStudents(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RemoveStudentsFromClassDto,
    @UserPayload() jwtPayload: JwtPayloadInterface,
    @OrgContext() orgContext: OrgContextType | null,
  ) {
    const payload = await this.classService.removeStudentsFromClass(
      id,
      dto.student_ids,
      jwtPayload,
      orgContext,
    );
    return { message: 'Students removed successfully', payload };
  }

  @Get(':id/students')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard, OrganizationContextGuard)
  @Roles(RolesEnum.TEACHER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get all students in a class' })
  async getStudents(
    @Param('id', ParseUUIDPipe) id: string,
    @UserPayload() jwtPayload: JwtPayloadInterface,
    @OrgContext() orgContext: OrgContextType | null,
  ) {
    const payload = await this.classService.getClassStudents(id, jwtPayload, orgContext);
    return { message: 'Students retrieved successfully', payload };
  }

  @Post(':id/students/bulk')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard, OrganizationContextGuard)
  @Roles(RolesEnum.TEACHER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @ApiOperation({ summary: 'Add students to class by phone or email (bulk)' })
  async addStudentsBulk(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddStudentsBulkDto,
    @UserPayload() jwtPayload: JwtPayloadInterface,
    @OrgContext() orgContext: OrgContextType | null,
  ) {
    const payload = await this.classService.addStudentsByPhoneOrEmail(
      id,
      dto.contacts,
      jwtPayload,
      orgContext,
    );
    return { message: 'Students processed successfully', payload };
  }

  @Post(':id/students/:studentId/approve')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard, OrganizationContextGuard)
  @Roles(RolesEnum.TEACHER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @ApiOperation({ summary: 'Approve a pending student' })
  async approveStudent(
    @Param('id', ParseUUIDPipe) classId: string,
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @UserPayload() jwtPayload: JwtPayloadInterface,
    @OrgContext() orgContext: OrgContextType | null,
  ) {
    const payload = await this.classService.approveStudent(
      classId,
      studentId,
      jwtPayload,
      orgContext,
    );
    return { message: 'Student approved successfully', payload };
  }

  @Post(':id/share')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard, OrganizationContextGuard)
  @Roles(RolesEnum.TEACHER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @ApiOperation({ summary: 'Generate join link for class' })
  async generateShareLink(
    @Param('id', ParseUUIDPipe) id: string,
    @UserPayload() jwtPayload: JwtPayloadInterface,
    @OrgContext() orgContext: OrgContextType | null,
  ) {
    const shareLink = await this.classService.generateShareLink(id, jwtPayload, orgContext);
    return { message: 'Share link generated successfully', payload: { shareLink } };
  }

  @Get(':id/subjects')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard, OrganizationContextGuard)
  @Roles(RolesEnum.TEACHER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @ApiOperation({ summary: 'List subjects and assigned teachers for a class' })
  async listSubjects(
    @Param('id', ParseUUIDPipe) id: string,
    @UserPayload() jwtPayload: JwtPayloadInterface,
    @OrgContext() orgContext: OrgContextType | null,
  ) {
    const payload = await this.classService.listClassSubjects(id, jwtPayload, orgContext);
    return { message: 'Class subjects retrieved successfully', payload };
  }

  @Get(':id/subjects/assigned')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard, OrganizationContextGuard)
  @Roles(RolesEnum.TEACHER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @ApiOperation({ summary: 'List subjects assigned to the current teacher in a class' })
  async listAssignedSubjects(
    @Param('id', ParseUUIDPipe) id: string,
    @UserPayload() jwtPayload: JwtPayloadInterface,
    @OrgContext() orgContext: OrgContextType | null,
  ) {
    const payload = await this.classService.listAssignedSubjectsForTeacher(
      id,
      jwtPayload.id,
      jwtPayload,
      orgContext,
    );
    return { message: 'Assigned class subjects retrieved successfully', payload };
  }

  @Post(':id/subjects')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard, OrganizationContextGuard)
  @Roles(RolesEnum.TEACHER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @ApiOperation({ summary: 'Add a subject to a class' })
  async addSubject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddClassSubjectDto,
    @UserPayload() jwtPayload: JwtPayloadInterface,
    @OrgContext() orgContext: OrgContextType | null,
  ) {
    const payload = await this.classService.addClassSubject(
      id,
      jwtPayload,
      orgContext,
      dto.subject_id,
      dto.name,
      dto.code,
    );
    return { message: 'Subject added to class', payload };
  }

  @Delete(':id/subjects/:classSubjectId')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard, OrganizationContextGuard)
  @Roles(RolesEnum.TEACHER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @ApiOperation({ summary: 'Remove a subject from a class' })
  async removeSubject(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('classSubjectId', ParseUUIDPipe) classSubjectId: string,
    @UserPayload() jwtPayload: JwtPayloadInterface,
    @OrgContext() orgContext: OrgContextType | null,
  ) {
    await this.classService.removeClassSubject(id, classSubjectId, jwtPayload, orgContext);
    return { message: 'Subject removed from class', payload: { removed: true } };
  }

  @Post(':id/subjects/:classSubjectId/teachers')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard, OrganizationContextGuard)
  @Roles(RolesEnum.TEACHER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @ApiOperation({ summary: 'Assign a teacher to a class subject' })
  async assignSubjectTeacher(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('classSubjectId', ParseUUIDPipe) classSubjectId: string,
    @Body() dto: AssignClassSubjectTeacherDto,
    @UserPayload() jwtPayload: JwtPayloadInterface,
    @OrgContext() orgContext: OrgContextType | null,
  ) {
    const payload = await this.classService.assignClassSubjectTeacher(
      id,
      classSubjectId,
      dto.teacher_id,
      jwtPayload,
      orgContext,
      dto.mirror_class_teacher !== false,
    );
    return { message: 'Teacher assigned to class subject', payload };
  }

  @Patch(':id/subjects/:classSubjectId/teachers/:assignmentId')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard, OrganizationContextGuard)
  @Roles(RolesEnum.TEACHER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @ApiOperation({ summary: 'Replace the teacher on a class subject assignment' })
  async updateSubjectTeacher(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('classSubjectId', ParseUUIDPipe) classSubjectId: string,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Body() dto: UpdateClassSubjectTeacherDto,
    @UserPayload() jwtPayload: JwtPayloadInterface,
    @OrgContext() orgContext: OrgContextType | null,
  ) {
    const payload = await this.classService.updateClassSubjectTeacher(
      id,
      classSubjectId,
      assignmentId,
      dto.teacher_id,
      jwtPayload,
      orgContext,
    );
    return { message: 'Class subject teacher updated', payload };
  }

  @Delete(':id/subjects/:classSubjectId/teachers/:assignmentId')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard, OrganizationContextGuard)
  @Roles(RolesEnum.TEACHER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @ApiOperation({ summary: 'Remove a teacher from a class subject' })
  async removeSubjectTeacher(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('classSubjectId', ParseUUIDPipe) classSubjectId: string,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @UserPayload() jwtPayload: JwtPayloadInterface,
    @OrgContext() orgContext: OrgContextType | null,
  ) {
    await this.classService.removeClassSubjectTeacher(
      id,
      classSubjectId,
      assignmentId,
      jwtPayload,
      orgContext,
    );
    return { message: 'Teacher removed from class subject', payload: { removed: true } };
  }
}
