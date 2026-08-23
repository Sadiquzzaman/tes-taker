import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserPayload } from 'src/common/decorators/user-payload.decorator';
import { RolesEnum } from 'src/common/enums/roles.enum';
import { RolesGuard } from 'src/common/guard/roles.guard';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';
import { OrganizationsService } from './organization.service';
import { AddOrganizationMemberDto } from './dto/add-organization-member.dto';
import { ImportOrganizationMembersDto } from './dto/import-organization-members.dto';
import { LookupOrganizationMemberDto } from './dto/lookup-organization-member.dto';
import { UpdateOrganizationMemberRoleDto } from './dto/update-organization-member-role.dto';
import { AssignTeacherSubjectDto } from './dto/assign-teacher-subject.dto';
import { CreateOrganizationSubjectDto } from './dto/create-organization-subject.dto';
import { UpdateOrganizationSubjectDto } from './dto/update-organization-subject.dto';

@ApiTags('Organizations')
@ApiBearerAuth('jwt')
@ApiHeader({
  name: 'X-Organization-Id',
  required: false,
  description: 'Optional. Empty = individual teacher workspace. Used by class/exam routes.',
})
@Controller({ path: 'organizations', version: '1' })
export class OrganizationController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get('mine')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.TEACHER, RolesEnum.STUDENT, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List organizations for the current user' })
  @ApiResponse({ status: 200, description: 'Organizations retrieved' })
  async listMine(@UserPayload() jwtPayload: JwtPayloadInterface) {
    const payload = await this.organizationsService.listMine(jwtPayload.id);
    return { message: 'Organizations retrieved successfully', payload };
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.TEACHER, RolesEnum.STUDENT, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get organization details (members only)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Organization retrieved' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @UserPayload() jwtPayload: JwtPayloadInterface,
  ) {
    const payload = await this.organizationsService.findOneForMember(id, jwtPayload.id);
    return { message: 'Organization retrieved successfully', payload };
  }

  @Get(':id/exams')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.TEACHER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List organization exams for monitoring',
    description:
      'OWNER/ADMIN see all org exams. Teachers see only exams they created. Does not grant edit/grade rights.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async listExams(
    @Param('id', ParseUUIDPipe) id: string,
    @UserPayload() jwtPayload: JwtPayloadInterface,
  ) {
    const payload = await this.organizationsService.listMonitorExams(id, jwtPayload.id);
    return { message: 'Organization exams retrieved successfully', payload };
  }

  @Get(':id/members/lookup')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.TEACHER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Lookup a user by Teacher/Student ID, phone, or email before adding',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async lookupMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: LookupOrganizationMemberDto,
    @UserPayload() jwtPayload: JwtPayloadInterface,
  ) {
    const payload = await this.organizationsService.lookupMemberCandidate(
      id,
      jwtPayload.id,
      query.q,
    );
    return { message: 'Lookup completed', payload };
  }

  @Get(':id/subjects')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.TEACHER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List organization subjects (Owner/Admin/Assistant)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async listSubjects(
    @Param('id', ParseUUIDPipe) id: string,
    @UserPayload() jwtPayload: JwtPayloadInterface,
  ) {
    const payload = await this.organizationsService.listOrganizationSubjects(id, jwtPayload.id);
    return { message: 'Organization subjects retrieved successfully', payload };
  }

  @Post(':id/subjects')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.TEACHER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an organization subject with name and code' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async createSubject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateOrganizationSubjectDto,
    @UserPayload() jwtPayload: JwtPayloadInterface,
  ) {
    const payload = await this.organizationsService.createOrganizationSubject(
      id,
      jwtPayload.id,
      dto,
      jwtPayload.full_name,
    );
    return { message: 'Subject created successfully', payload };
  }

  @Patch(':id/subjects/:subjectId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.TEACHER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update an organization subject' })
  async updateSubject(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('subjectId', ParseUUIDPipe) subjectId: string,
    @Body() dto: UpdateOrganizationSubjectDto,
    @UserPayload() jwtPayload: JwtPayloadInterface,
  ) {
    const payload = await this.organizationsService.updateOrganizationSubject(
      id,
      subjectId,
      jwtPayload.id,
      dto,
      jwtPayload.full_name,
    );
    return { message: 'Subject updated successfully', payload };
  }

  @Delete(':id/subjects/:subjectId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.TEACHER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete an unused organization subject' })
  async removeSubject(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('subjectId', ParseUUIDPipe) subjectId: string,
    @UserPayload() jwtPayload: JwtPayloadInterface,
  ) {
    const payload = await this.organizationsService.removeOrganizationSubject(
      id,
      subjectId,
      jwtPayload.id,
    );
    return { message: 'Subject deleted successfully', payload };
  }

  @Get(':id/assignable-teachers')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.TEACHER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List teachers that can be assigned to a class subject' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async listAssignableTeachers(
    @Param('id', ParseUUIDPipe) id: string,
    @UserPayload() jwtPayload: JwtPayloadInterface,
  ) {
    const payload = await this.organizationsService.listAssignableTeachers(id, jwtPayload.id);
    return { message: 'Assignable teachers retrieved successfully', payload };
  }

  @Get(':id/members')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.TEACHER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List active organization members' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async listMembers(
    @Param('id', ParseUUIDPipe) id: string,
    @UserPayload() jwtPayload: JwtPayloadInterface,
  ) {
    const payload = await this.organizationsService.listMembers(id, jwtPayload.id);
    return { message: 'Members retrieved successfully', payload };
  }

  @Post(':id/members')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.TEACHER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add an existing member or invite by phone/email/public ID',
    description:
      'Reuses an existing user when found. Soft-reactivates prior memberships. Otherwise creates an organization invitation (SMS/email). Does not create duplicate users.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async addMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddOrganizationMemberDto,
    @UserPayload() jwtPayload: JwtPayloadInterface,
  ) {
    const payload = await this.organizationsService.addMember(id, jwtPayload.id, dto);
    const message =
      payload.status === 'invited'
        ? 'Invitation sent successfully'
        : 'Member added successfully';
    return { message, payload };
  }

  @Post(':id/members/import')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.TEACHER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Bulk import members by public ID / phone / email with row-level results',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async importMembers(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ImportOrganizationMembersDto,
    @UserPayload() jwtPayload: JwtPayloadInterface,
  ) {
    const payload = await this.organizationsService.importMembers(id, jwtPayload.id, dto);
    return { message: 'Member import completed', payload };
  }

  @Patch(':id/members/:memberId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.TEACHER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update organization member role (OWNER/ADMIN only)' })
  async updateMemberRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: UpdateOrganizationMemberRoleDto,
    @UserPayload() jwtPayload: JwtPayloadInterface,
  ) {
    const payload = await this.organizationsService.updateMemberRole(
      id,
      memberId,
      jwtPayload.id,
      dto.role,
    );
    return { message: 'Member role updated successfully', payload };
  }

  @Delete(':id/members/:memberId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.TEACHER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Soft-remove an organization member (OWNER/ADMIN/ASSISTANT)',
    description: 'Archives membership; does not hard-delete history.',
  })
  async removeMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @UserPayload() jwtPayload: JwtPayloadInterface,
  ) {
    await this.organizationsService.removeMember(id, memberId, jwtPayload.id);
    return { message: 'Member removed successfully', payload: null };
  }

  @Get(':id/teachers/:teacherId/subjects')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.TEACHER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List subjects assigned to a teacher in the organization' })
  async listTeacherSubjects(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('teacherId', ParseUUIDPipe) teacherId: string,
    @UserPayload() jwtPayload: JwtPayloadInterface,
  ) {
    const payload = await this.organizationsService.listTeacherSubjects(
      id,
      teacherId,
      jwtPayload.id,
    );
    return { message: 'Teacher subjects retrieved successfully', payload };
  }

  @Post(':id/teachers/:teacherId/subjects')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.TEACHER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Assign a subject to a teacher (OWNER/ADMIN only)' })
  async assignTeacherSubject(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('teacherId', ParseUUIDPipe) teacherId: string,
    @Body() dto: AssignTeacherSubjectDto,
    @UserPayload() jwtPayload: JwtPayloadInterface,
  ) {
    const payload = await this.organizationsService.assignTeacherSubject(
      id,
      teacherId,
      dto.subject_id,
      jwtPayload.id,
    );
    return { message: 'Subject assigned successfully', payload };
  }

  @Delete(':id/teachers/:teacherId/subjects/:subjectId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.TEACHER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unassign a subject from a teacher (OWNER/ADMIN only)' })
  async unassignTeacherSubject(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('teacherId', ParseUUIDPipe) teacherId: string,
    @Param('subjectId', ParseUUIDPipe) subjectId: string,
    @UserPayload() jwtPayload: JwtPayloadInterface,
  ) {
    await this.organizationsService.unassignTeacherSubject(
      id,
      teacherId,
      subjectId,
      jwtPayload.id,
    );
    return { message: 'Subject unassigned successfully', payload: null };
  }
}
