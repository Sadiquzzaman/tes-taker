import { Body, Controller, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserPayload } from 'src/common/decorators/user-payload.decorator';
import { RolesEnum } from 'src/common/enums/roles.enum';
import { RolesGuard } from 'src/common/guard/roles.guard';
import { OrganizationContextGuard } from 'src/organizations/guards/organization-context.guard';
import { AcademicAccess } from './academic-access';
import { StudentImportDto } from './dto/student-import.dto';
import { StudentImportService } from './student-import.service';

/** Student CSV import into a class's sections, with a preview (FND-04). */
@ApiTags('Sections and subject classes')
@ApiBearerAuth('jwt')
@ApiHeader({ name: 'X-Organization-Id', required: false, description: 'Organisation workspace; empty = your own workspace' })
@UseGuards(AuthGuard('jwt'), RolesGuard, OrganizationContextGuard)
@Roles(RolesEnum.TEACHER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
@Controller({ version: '1' })
export class StudentImportController {
  constructor(private readonly imports: StudentImportService) {}

  @Post('classes/:classId/students/import/preview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check CSV rows without saving: problems per row, and the plan limit (Owner/Admin/Assistant)' })
  async preview(@Param('classId', ParseUUIDPipe) classId: string, @Body() dto: StudentImportDto) {
    AcademicAccess.manageStructure();
    return { message: 'Import checked', payload: await this.imports.preview(classId, dto) };
  }

  @Post('classes/:classId/students/import')
  @ApiOperation({
    summary: 'Import CSV rows: saves the rows that pass the checks (Owner/Admin/Assistant)',
    description: 'Refused with PLAN_LIMIT_REACHED (nothing saved) when the students would exceed the plan. Invitations are sent only with send_invitations.',
  })
  async import(@Param('classId', ParseUUIDPipe) classId: string, @Body() dto: StudentImportDto, @UserPayload() user: JwtPayloadInterface) {
    AcademicAccess.manageStructure();
    return { message: 'Students imported', payload: await this.imports.import(classId, dto, user) };
  }
}
