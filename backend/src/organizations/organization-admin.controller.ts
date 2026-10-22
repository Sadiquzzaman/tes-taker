import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
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
import { ListOrganizationsQueryDto } from './dto/list-organizations-query.dto';
import { RejectOrganizationDto } from './dto/reject-organization.dto';

@ApiTags('Organizations Admin')
@ApiBearerAuth('jwt')
@Controller({ path: 'organizations/admin', version: '1' })
export class OrganizationAdminController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List organizations for admin review',
    description: 'Defaults to pending organizations when status is omitted.',
  })
  @ApiResponse({ status: 200, description: 'Organizations retrieved' })
  async listForAdmin(@Query() query: ListOrganizationsQueryDto) {
    const { organizations, meta } = await this.organizationsService.listForAdmin(query);
    return { message: 'Organizations retrieved successfully', payload: organizations, meta };
  }

  @Patch(':id/approve')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve a pending organization' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Organization approved' })
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @UserPayload() jwtPayload: JwtPayloadInterface,
  ) {
    const payload = await this.organizationsService.approve(jwtPayload.id, id);
    return { message: 'Organization approved successfully', payload };
  }

  @Patch(':id/reject')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject a pending organization' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Organization rejected' })
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectOrganizationDto,
    @UserPayload() jwtPayload: JwtPayloadInterface,
  ) {
    const payload = await this.organizationsService.reject(jwtPayload.id, id, dto.reason);
    return { message: 'Organization rejected successfully', payload };
  }
}
