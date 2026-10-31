import { Body, Controller, Get, Param, ParseUUIDPipe, Put, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserPayload } from 'src/common/decorators/user-payload.decorator';
import { RolesEnum } from 'src/common/enums/roles.enum';
import { RolesGuard } from 'src/common/guard/roles.guard';
import { OrganizationContextGuard } from 'src/organizations/guards/organization-context.guard';
import { SaveGuardiansDto } from './dto/guardian.dto';
import { GuardiansService } from './guardians.service';

/** A student's guardians (FND-09) and SMS language (FND-10), reached through one of the student's enrolments. */
@ApiTags('Guardians')
@ApiBearerAuth('jwt')
@ApiHeader({ name: 'X-Organization-Id', required: false, description: 'Organisation workspace; empty = your own workspace' })
@UseGuards(AuthGuard('jwt'), RolesGuard, OrganizationContextGuard)
@Roles(RolesEnum.TEACHER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
@Controller({ version: '1' })
export class GuardiansController {
  constructor(private readonly guardians: GuardiansService) {}

  @Get('enrolments/:id/guardians')
  @ApiOperation({ summary: "The student's guardians and SMS language (Owner/Admin/Assistant, or a teacher of the class)" })
  async list(@Param('id', ParseUUIDPipe) id: string, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Guardians retrieved successfully', payload: await this.guardians.listForEnrolment(id, user) };
  }

  @Put('enrolments/:id/guardians')
  @ApiOperation({
    summary: "Save the student's guardians (at most 2, one primary) and SMS language",
    description: 'Guardians left out of the list are removed but kept in history. Every change is in the audit log.',
  })
  async save(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SaveGuardiansDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Guardians saved successfully', payload: await this.guardians.saveForEnrolment(id, dto, user) };
  }
}
