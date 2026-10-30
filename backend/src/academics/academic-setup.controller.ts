import { Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserPayload } from 'src/common/decorators/user-payload.decorator';
import { RolesEnum } from 'src/common/enums/roles.enum';
import { RolesGuard } from 'src/common/guard/roles.guard';
import { OrganizationContextGuard } from 'src/organizations/guards/organization-context.guard';
import { AcademicAccess } from './academic-access';
import { AcademicSetupService } from './academic-setup.service';

/** The academic setup wizard of a school or coaching centre (P2-04, FND-02). */
@ApiTags('Academic setup')
@ApiBearerAuth('jwt')
@ApiHeader({ name: 'X-Organization-Id', required: true, description: 'The organisation being set up' })
@UseGuards(AuthGuard('jwt'), RolesGuard, OrganizationContextGuard)
@Roles(RolesEnum.TEACHER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
@Controller({ path: 'setup', version: '1' })
export class AcademicSetupController {
  constructor(private readonly setup: AcademicSetupService) {}

  @Get()
  @ApiOperation({ summary: 'Setup progress: finished or not, the default session, and each class with its subjects and sections (Owner/Admin)' })
  async summary() {
    AcademicAccess.manageSessions();
    return { message: 'Setup retrieved successfully', payload: await this.setup.summary() };
  }

  @Post('complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Finish the setup; every class needs a section in the default session (Owner/Admin)' })
  async complete(@UserPayload() user: JwtPayloadInterface) {
    AcademicAccess.manageSessions();
    return { message: 'Setup finished successfully', payload: await this.setup.complete(user.id) };
  }
}
