import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';
import { UserPayload } from 'src/common/decorators/user-payload.decorator';
import { TenantContext } from 'src/common/tenancy/tenant-context';
import { OrganizationContextGuard } from 'src/organizations/guards/organization-context.guard';
import { CreateFeatureRequestDto } from './dto/plan-management.dto';
import { EntitlementsService } from './entitlements.service';
import { SubscriptionService } from './subscription.service';

/** What the signed-in user's current workspace may use (design §8.3). */
@ApiTags('Me')
@Controller({ path: 'me', version: '1' })
export class MeController {
  constructor(
    private readonly entitlementsService: EntitlementsService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  @Get('entitlements')
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: "The current workspace's plan, features, limits and usage",
    description: 'Clients hide locked menus with it (FND-07). 403 when no workspace is chosen.',
  })
  @UseGuards(AuthGuard('jwt'), OrganizationContextGuard)
  async getEntitlements() {
    const payload = await this.entitlementsService.getEntitlements(TenantContext.requireOrganizationId());
    return { message: 'Entitlements retrieved successfully', payload };
  }

  @Post('feature-requests')
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: '"Request this feature" for the current workspace (FND-08)' })
  @UseGuards(AuthGuard('jwt'), OrganizationContextGuard)
  async requestFeature(@Body() dto: CreateFeatureRequestDto, @UserPayload() jwtPayload: JwtPayloadInterface) {
    const payload = await this.subscriptionService.createFeatureRequest(dto, jwtPayload);
    return { message: 'Request sent', payload };
  }
}
