import { Body, Controller, ForbiddenException, Get, Put, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';
import { UserPayload } from 'src/common/decorators/user-payload.decorator';
import { Tenant, TenantContext } from 'src/common/tenancy/tenant-context';
import { OrganizationContextGuard } from 'src/organizations/guards/organization-context.guard';
import { FeatureKey } from 'src/subscriptions/constants/feature-catalog';
import { RequiresFeature } from 'src/subscriptions/decorators/requires-feature.decorator';
import { FeatureGuard } from 'src/subscriptions/guards/feature.guard';
import { BehaviourService } from './behaviour.service';
import { BehaviourGridQueryDto, SaveBehaviourCriteriaDto, SaveBehaviourDto } from './dto/behaviour.dto';

const workspace = (): Tenant => {
  const tenant = TenantContext.current();
  if (!tenant) throw new ForbiddenException('Choose a workspace first');
  return tenant;
};

/** Class behaviour ratings (P7-01, PRF-04). Needs the `performance` feature. */
@ApiTags('Behaviour')
@ApiBearerAuth('jwt')
@ApiHeader({ name: 'X-Organization-Id', required: false, description: 'Organisation workspace; empty = your own workspace' })
@UseGuards(AuthGuard('jwt'), OrganizationContextGuard, FeatureGuard)
@RequiresFeature(FeatureKey.PERFORMANCE)
@Controller({ path: 'behaviour', version: '1' })
export class BehaviourController {
  constructor(private readonly behaviour: BehaviourService) {}

  @Get('criteria')
  @ApiOperation({ summary: "The organisation's behaviour criteria, in order (the defaults the first time); staff only" })
  async criteria() {
    return { message: 'Criteria retrieved successfully', payload: await this.behaviour.criteriaForStaff(workspace()) };
  }

  @Put('criteria')
  @ApiOperation({ summary: 'Replace the criteria list (owners and admins); criteria left out are retired, their ratings kept' })
  async saveCriteria(@Body() dto: SaveBehaviourCriteriaDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Criteria saved', payload: await this.behaviour.saveCriteria(workspace(), user, dto.criteria) };
  }

  @Get('grid')
  @ApiOperation({ summary: "A subject class's ratings on a date: every student × criterion, with remarks" })
  async grid(@Query() query: BehaviourGridQueryDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Ratings retrieved successfully', payload: await this.behaviour.grid(workspace(), user.id, query.offering_id, query.date) };
  }

  @Put('grid')
  @ApiOperation({ summary: "Save a day's ratings 1–5 and remarks; every change is in the audit log" })
  async save(@Body() dto: SaveBehaviourDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Ratings saved', payload: await this.behaviour.save(workspace(), user, dto.offering_id, dto.date, dto.rows) };
  }
}
