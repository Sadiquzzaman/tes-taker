import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserPayload } from 'src/common/decorators/user-payload.decorator';
import { RolesEnum } from 'src/common/enums/roles.enum';
import { RolesGuard } from 'src/common/guard/roles.guard';
import { OrganizationContextGuard } from 'src/organizations/guards/organization-context.guard';
import { AcademicAccess } from './academic-access';
import { AcademicSessionsService } from './academic-sessions.service';
import { CreateAcademicSessionDto, CreateTermDto, UpdateAcademicSessionDto, UpdateTermDto } from './dto/session.dto';

/** Academic sessions and terms of the current workspace (FND-01). */
@ApiTags('Academic sessions')
@ApiBearerAuth('jwt')
@ApiHeader({ name: 'X-Organization-Id', required: false, description: 'Organisation workspace; empty = your own workspace' })
@UseGuards(AuthGuard('jwt'), RolesGuard, OrganizationContextGuard)
@Roles(RolesEnum.TEACHER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
@Controller({ version: '1' })
export class AcademicSessionsController {
  constructor(private readonly sessions: AcademicSessionsService) {}

  @Get('sessions')
  @ApiOperation({ summary: 'List sessions (the default one is created on first use)' })
  async list() {
    AcademicAccess.read();
    return { message: 'Sessions retrieved successfully', payload: await this.sessions.list() };
  }

  @Post('sessions')
  @ApiOperation({ summary: 'Create a session (Owner/Admin)' })
  async create(@Body() dto: CreateAcademicSessionDto, @UserPayload() user: JwtPayloadInterface) {
    AcademicAccess.manageSessions();
    return { message: 'Session created successfully', payload: await this.sessions.create(dto, user) };
  }

  @Patch('sessions/:id')
  @ApiOperation({ summary: 'Rename a session or change its dates (Owner/Admin)' })
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAcademicSessionDto, @UserPayload() user: JwtPayloadInterface) {
    AcademicAccess.manageSessions();
    return { message: 'Session updated successfully', payload: await this.sessions.update(id, dto, user) };
  }

  @Post('sessions/:id/default')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Make this the default session (Owner/Admin)' })
  async setDefault(@Param('id', ParseUUIDPipe) id: string, @UserPayload() user: JwtPayloadInterface) {
    AcademicAccess.manageSessions();
    return { message: 'Default session changed successfully', payload: await this.sessions.setDefault(id, user) };
  }

  @Post('sessions/:id/close')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Close a session; its records become read-only (Owner/Admin)' })
  async close(@Param('id', ParseUUIDPipe) id: string, @UserPayload() user: JwtPayloadInterface) {
    AcademicAccess.manageSessions();
    return { message: 'Session closed successfully', payload: await this.sessions.close(id, user) };
  }

  @Post('sessions/:id/reopen')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reopen a closed session (Owner only)' })
  async reopen(@Param('id', ParseUUIDPipe) id: string, @UserPayload() user: JwtPayloadInterface) {
    AcademicAccess.reopenSession();
    return { message: 'Session reopened successfully', payload: await this.sessions.reopen(id, user) };
  }

  @Get('sessions/:id/terms')
  @ApiOperation({ summary: 'List the terms of a session' })
  async listTerms(@Param('id', ParseUUIDPipe) id: string) {
    AcademicAccess.read();
    return { message: 'Terms retrieved successfully', payload: await this.sessions.listTerms(id) };
  }

  @Post('sessions/:id/terms')
  @ApiOperation({ summary: 'Add a term to a session (Owner/Admin)' })
  async createTerm(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateTermDto, @UserPayload() user: JwtPayloadInterface) {
    AcademicAccess.manageSessions();
    return { message: 'Term created successfully', payload: await this.sessions.createTerm(id, dto, user) };
  }

  @Patch('terms/:id')
  @ApiOperation({ summary: 'Change a term (Owner/Admin)' })
  async updateTerm(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTermDto, @UserPayload() user: JwtPayloadInterface) {
    AcademicAccess.manageSessions();
    return { message: 'Term updated successfully', payload: await this.sessions.updateTerm(id, dto, user) };
  }

  @Delete('terms/:id')
  @ApiOperation({ summary: 'Delete a term (Owner/Admin)' })
  async removeTerm(@Param('id', ParseUUIDPipe) id: string) {
    AcademicAccess.manageSessions();
    await this.sessions.removeTerm(id);
    return { message: 'Term deleted successfully' };
  }
}
