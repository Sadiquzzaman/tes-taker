import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserPayload } from 'src/common/decorators/user-payload.decorator';
import { RolesEnum } from 'src/common/enums/roles.enum';
import { RolesGuard } from 'src/common/guard/roles.guard';
import { UpdateLevelLabelsDto } from './dto/update-level-labels.dto';
import { OrganizationContextGuard } from './guards/organization-context.guard';
import { OrgSettingsService } from './org-settings.service';

/** Settings of the current workspace (an organisation or a solo teacher's own), resolved from the request. */
@ApiTags('Workspace')
@ApiBearerAuth('jwt')
@ApiHeader({ name: 'X-Organization-Id', required: false, description: 'Organisation workspace; empty = your own workspace' })
@UseGuards(AuthGuard('jwt'), RolesGuard, OrganizationContextGuard)
@Roles(RolesEnum.TEACHER, RolesEnum.STUDENT, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
@Controller({ path: 'workspace', version: '1' })
export class WorkspaceController {
  constructor(private readonly orgSettingsService: OrgSettingsService) {}

  @Get('level-labels')
  @ApiOperation({ summary: 'What this workspace calls its classes and sections, in English and Bangla (FND-03)' })
  async levelLabels() {
    return { message: 'Level names retrieved successfully', payload: await this.orgSettingsService.currentLevelLabels() };
  }

  @Patch('level-labels')
  @ApiOperation({ summary: 'Rename classes and sections: Class/Section, Course/Batch or your own words (Owner)' })
  async updateLevelLabels(@Body() dto: UpdateLevelLabelsDto, @UserPayload() user: JwtPayloadInterface) {
    return {
      message: 'Level names saved successfully',
      payload: await this.orgSettingsService.updateCurrentLevelLabels(user.id, dto),
    };
  }
}
