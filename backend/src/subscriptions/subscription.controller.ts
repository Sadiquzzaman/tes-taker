import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { TenantContext } from 'src/common/tenancy/tenant-context';
import { OrganizationContextGuard } from 'src/organizations/guards/organization-context.guard';
import { RolesGuard } from 'src/common/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesEnum } from 'src/common/enums/roles.enum';
import { UserPayload } from 'src/common/decorators/user-payload.decorator';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';
import { SubscriptionService } from './subscription.service';
import { EntitlementsService } from './entitlements.service';
import {
  FEATURE_CATALOG,
  LIMIT_CATALOG,
} from './constants/feature-catalog';
import { PlanVisibilityEnum } from './entities/subscription-plan.entity';
import { FeatureRequestStatusEnum } from './entities/feature-request.entity';
import {
  AssignPlanDto,
  ChangePlanDto,
  CreatePlanDto,
  GrantTempAccessDto,
  ReorderPlansDto,
  SetFeatureOverrideDto,
  SetTeacherActiveDto,
  SubscribeByPlanIdDto,
  SubscriptionOverridesDto,
  UpdatePlanDto,
} from './dto/plan-management.dto';

@ApiTags('Subscriptions')
@Controller({
  path: 'subscriptions',
  version: '1',
})
export class SubscriptionController {
  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly entitlementsService: EntitlementsService,
  ) {}

  // ========================
  // PUBLIC ENDPOINTS
  // ========================

  @Get('plans')
  @ApiOperation({ summary: 'Get public subscription plans' })
  async getAllPlans() {
    const payload = await this.subscriptionService.getAllPlans();
    return { message: 'Subscription plans retrieved successfully', payload };
  }

  @Get('plans/:planId')
  @ApiOperation({ summary: 'Get plan by ID' })
  async getPlanById(@Param('planId', ParseUUIDPipe) planId: string) {
    const payload = await this.subscriptionService.getPlanById(planId);
    return { message: 'Plan retrieved successfully', payload };
  }

  @Get('feature-catalog')
  @ApiOperation({ summary: 'Get feature and limit catalog' })
  getFeatureCatalog() {
    return {
      message: 'Feature catalog retrieved successfully',
      payload: { features: FEATURE_CATALOG, limits: LIMIT_CATALOG },
    };
  }

  // ========================
  // TEACHER ENDPOINTS
  // ========================

  // The routes below act on the current workspace (P2-02): a solo teacher's SOLO organisation,
  // or the school of an organisation session. OrganizationContextGuard resolves it.

  @Get('my-subscription')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard, OrganizationContextGuard)
  @Roles(RolesEnum.TEACHER)
  async getMySubscription() {
    const payload = await this.subscriptionService.getAccountSubscription(TenantContext.requireOrganizationId());
    return {
      message: payload ? 'Subscription retrieved successfully' : 'No active subscription',
      payload,
    };
  }

  /** Kept for one release; use GET /me/entitlements. */
  @Get('my-entitlements')
  @ApiBearerAuth('jwt')
  @ApiOperation({ deprecated: true, summary: 'Deprecated: use GET /me/entitlements' })
  @UseGuards(AuthGuard('jwt'), RolesGuard, OrganizationContextGuard)
  @Roles(RolesEnum.TEACHER)
  async getMyEntitlements() {
    const payload = await this.entitlementsService.getEntitlements(TenantContext.requireOrganizationId());
    return { message: 'Entitlements retrieved successfully', payload };
  }

  @Post('subscribe')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard, OrganizationContextGuard)
  @Roles(RolesEnum.TEACHER)
  async subscribe(@Body() dto: SubscribeByPlanIdDto, @UserPayload() jwtPayload: JwtPayloadInterface) {
    const payload = await this.subscriptionService.subscribe(dto, jwtPayload);
    return { message: 'Subscription created successfully', payload };
  }

  @Post('upgrade')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard, OrganizationContextGuard)
  @Roles(RolesEnum.TEACHER)
  async upgrade(@Body() dto: ChangePlanDto, @UserPayload() jwtPayload: JwtPayloadInterface) {
    const payload = await this.subscriptionService.upgradePlan(dto, jwtPayload);
    return { message: 'Plan upgraded successfully', payload };
  }

  @Post('downgrade')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard, OrganizationContextGuard)
  @Roles(RolesEnum.TEACHER)
  async downgrade(@Body() dto: ChangePlanDto, @UserPayload() jwtPayload: JwtPayloadInterface) {
    const payload = await this.subscriptionService.downgradePlan(dto, jwtPayload);
    return { message: 'Plan downgraded successfully', payload };
  }

  @Post('cancel')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard, OrganizationContextGuard)
  @Roles(RolesEnum.TEACHER)
  async cancel(@UserPayload() jwtPayload: JwtPayloadInterface) {
    const payload = await this.subscriptionService.cancelSubscription(TenantContext.requireOrganizationId(), jwtPayload.id);
    return { message: 'Subscription cancelled', payload };
  }

  @Get('my-payment-history')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard, OrganizationContextGuard)
  @Roles(RolesEnum.TEACHER)
  async getMyPaymentHistory(@UserPayload() jwtPayload: JwtPayloadInterface) {
    const organizationId = TenantContext.requireOrganizationId();
    await this.subscriptionService.assertCanManageBilling(organizationId, jwtPayload.id);
    const payload = await this.subscriptionService.getPaymentHistory(organizationId);
    return { message: 'Payment history retrieved successfully', payload };
  }

  @Get('can-create-exam')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard, OrganizationContextGuard)
  @Roles(RolesEnum.TEACHER)
  async canCreateExam() {
    const payload = await this.entitlementsService.canCreateExam(TenantContext.requireOrganizationId());
    return { message: 'Eligibility check completed', payload };
  }

  // ========================
  // ADMIN ENDPOINTS
  // ========================

  @Get('admin/plans')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  async getAllPlansAdmin() {
    const payload = await this.subscriptionService.getAllPlansAdmin();
    return { message: 'Plans retrieved successfully', payload };
  }

  @Post('admin/plans')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  async createPlan(
    @Body() dto: CreatePlanDto,
    @UserPayload() jwtPayload: JwtPayloadInterface,
  ) {
    const payload = await this.subscriptionService.createPlan(dto, jwtPayload);
    return { message: 'Plan created successfully', payload };
  }

  @Patch('admin/plans/:planId')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  async updatePlan(
    @Param('planId', ParseUUIDPipe) planId: string,
    @Body() dto: UpdatePlanDto,
    @UserPayload() jwtPayload: JwtPayloadInterface,
  ) {
    const payload = await this.subscriptionService.updatePlan(planId, dto, jwtPayload);
    return { message: 'Plan updated successfully', payload };
  }

  @Delete('admin/plans/:planId')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  async deletePlan(
    @Param('planId', ParseUUIDPipe) planId: string,
    @UserPayload() jwtPayload: JwtPayloadInterface,
  ) {
    await this.subscriptionService.deletePlan(planId, jwtPayload);
    return { message: 'Plan deleted successfully', payload: null };
  }

  @Post('admin/plans/:planId/clone')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  async clonePlan(
    @Param('planId', ParseUUIDPipe) planId: string,
    @UserPayload() jwtPayload: JwtPayloadInterface,
  ) {
    const payload = await this.subscriptionService.clonePlan(planId, jwtPayload);
    return { message: 'Plan cloned successfully', payload };
  }

  @Patch('admin/plans/reorder')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  async reorderPlans(@Body() dto: ReorderPlansDto, @UserPayload() jwtPayload: JwtPayloadInterface) {
    const payload = await this.subscriptionService.reorderPlans(dto, jwtPayload);
    return { message: 'Plans reordered successfully', payload };
  }

  @Patch('admin/plans/:planId/activate')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  async activatePlan(
    @Param('planId', ParseUUIDPipe) planId: string,
    @UserPayload() jwtPayload: JwtPayloadInterface,
  ) {
    const payload = await this.subscriptionService.setPlanActive(planId, true, jwtPayload);
    return { message: 'Plan activated successfully', payload };
  }

  @Patch('admin/plans/:planId/deactivate')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  async deactivatePlan(
    @Param('planId', ParseUUIDPipe) planId: string,
    @UserPayload() jwtPayload: JwtPayloadInterface,
  ) {
    const payload = await this.subscriptionService.setPlanActive(planId, false, jwtPayload);
    return { message: 'Plan deactivated successfully', payload };
  }

  @Post('admin/assign')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  async adminAssignSubscription(
    @Body() dto: AssignPlanDto,
    @UserPayload() jwtPayload: JwtPayloadInterface,
  ) {
    const payload = await this.subscriptionService.assignPlan(dto, jwtPayload);
    return { message: 'Subscription assigned successfully', payload };
  }

  @Patch('admin/confirm-payment/:paymentId')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  async confirmPayment(
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @Body('transaction_id') transactionId: string,
    @UserPayload() jwtPayload: JwtPayloadInterface,
  ) {
    const payload = await this.subscriptionService.confirmPayment(paymentId, transactionId, jwtPayload);
    return { message: 'Payment confirmed successfully', payload };
  }

  @Get('admin/all-subscriptions')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  async getAllSubscriptions() {
    const payload = await this.subscriptionService.getAllSubscriptions();
    return { message: 'Subscriptions retrieved successfully', payload };
  }

  @Get('admin/stats')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  async getAdminStats() {
    const payload = await this.subscriptionService.getAdminStats();
    return { message: 'Admin stats retrieved successfully', payload };
  }

  @Get('admin/payments')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  async getAdminPayments(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const payload = await this.subscriptionService.getAdminPayments(Number(page), Number(limit));
    return {
      message: 'Payments retrieved successfully',
      payload: payload.items,
      meta: { total: payload.total, page: payload.page, limit: payload.limit },
    };
  }

  @Get('admin/teacher/:teacherId/subscription')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  async getTeacherSubscription(@Param('teacherId', ParseUUIDPipe) teacherId: string) {
    // A teacher's own plan now lives on their SOLO organisation (P2-02).
    const organizationId = await this.subscriptionService.resolveAdminTarget({ teacher_id: teacherId });
    const payload = await this.subscriptionService.getAccountSubscription(organizationId);
    return {
      message: payload ? 'Subscription retrieved successfully' : 'No active subscription',
      payload,
    };
  }

  @Get('admin/teacher/:teacherId/payment-history')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  async getTeacherPaymentHistory(@Param('teacherId', ParseUUIDPipe) teacherId: string) {
    const organizationId = await this.subscriptionService.resolveAdminTarget({ teacher_id: teacherId });
    const payload = await this.subscriptionService.getPaymentHistory(organizationId);
    return { message: 'Payment history retrieved successfully', payload };
  }

  @Patch('admin/teacher/:teacherId/status')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  async setTeacherActive(
    @Param('teacherId', ParseUUIDPipe) teacherId: string,
    @Body() dto: SetTeacherActiveDto,
    @UserPayload() jwtPayload: JwtPayloadInterface,
  ) {
    const payload = await this.subscriptionService.setTeacherActive(teacherId, dto.active, jwtPayload);
    return {
      message: dto.active ? 'Teacher enabled successfully' : 'Teacher disabled successfully',
      payload,
    };
  }

  // ========================
  // ORGANISATION ENTITLEMENTS (FND-07, FND-08)
  // ========================

  @Get('admin/organizations/:organizationId/entitlements')
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: "An organisation's plan, the platform admin's overrides and what it may use now" })
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  async getOrganizationEntitlements(@Param('organizationId', ParseUUIDPipe) organizationId: string) {
    const payload = await this.subscriptionService.getAdminOrganizationEntitlements(organizationId);
    return { message: 'Entitlements retrieved successfully', payload };
  }

  @Put('admin/organizations/:organizationId/overrides/:key')
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: 'Switch one feature on or off, or set one limit, for an organisation' })
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  async setOrganizationOverride(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('key') key: string,
    @Body() dto: SetFeatureOverrideDto,
    @UserPayload() jwtPayload: JwtPayloadInterface,
  ) {
    const payload = await this.subscriptionService.setOverride(organizationId, key, dto, jwtPayload);
    return { message: 'Override saved', payload };
  }

  @Delete('admin/organizations/:organizationId/overrides/:key')
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: "Remove an override; the organisation's plan applies again" })
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  async removeOrganizationOverride(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('key') key: string,
    @UserPayload() jwtPayload: JwtPayloadInterface,
  ) {
    await this.subscriptionService.removeOverride(organizationId, key, jwtPayload);
    return { message: 'Override removed' };
  }

  @Get('admin/feature-requests')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  async listFeatureRequests(@Query('status') status?: FeatureRequestStatusEnum) {
    const payload = await this.subscriptionService.listFeatureRequests(status);
    return { message: 'Feature requests retrieved successfully', payload };
  }

  @Patch('admin/feature-requests/:id/handled')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  async markFeatureRequestHandled(
    @Param('id', ParseUUIDPipe) id: string,
    @UserPayload() jwtPayload: JwtPayloadInterface,
  ) {
    const payload = await this.subscriptionService.markFeatureRequestHandled(id, jwtPayload);
    return { message: 'Request marked as handled', payload };
  }

  // ========================
  // SUPER ADMIN ENDPOINTS
  // ========================

  @Post('super-admin/custom-plans')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.SUPER_ADMIN)
  async createCustomPlan(
    @Body() dto: CreatePlanDto,
    @UserPayload() jwtPayload: JwtPayloadInterface,
  ) {
    const payload = await this.subscriptionService.createPlan(
      { ...dto, is_custom: true, visibility: dto.visibility ?? PlanVisibilityEnum.HIDDEN },
      jwtPayload,
    );
    return { message: 'Custom plan created successfully', payload };
  }

  @Patch('super-admin/teacher/:teacherId/overrides')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.SUPER_ADMIN)
  async setOverrides(
    @Param('teacherId', ParseUUIDPipe) teacherId: string,
    @Body() dto: SubscriptionOverridesDto,
    @UserPayload() jwtPayload: JwtPayloadInterface,
  ) {
    const payload = await this.subscriptionService.setSubscriptionOverrides({ teacher_id: teacherId }, dto, jwtPayload);
    return { message: 'Overrides applied successfully', payload };
  }

  @Post('super-admin/grant-temp-access')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.SUPER_ADMIN)
  async grantTempAccess(
    @Body() dto: GrantTempAccessDto,
    @UserPayload() jwtPayload: JwtPayloadInterface,
  ) {
    const payload = await this.subscriptionService.grantTempAccess(dto, jwtPayload);
    return { message: 'Temporary access granted successfully', payload };
  }

  @Post('super-admin/teacher/:teacherId/force-change')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.SUPER_ADMIN)
  async forceChangePlan(
    @Param('teacherId', ParseUUIDPipe) teacherId: string,
    @Body() dto: ChangePlanDto,
    @UserPayload() jwtPayload: JwtPayloadInterface,
  ) {
    const payload = await this.subscriptionService.forceChangePlan(teacherId, dto, jwtPayload);
    return { message: 'Plan force-changed successfully', payload };
  }

  @Get('super-admin/revenue')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.SUPER_ADMIN)
  async getPlatformRevenue() {
    const stats = await this.subscriptionService.getAdminStats();
    return {
      message: 'Platform revenue retrieved successfully',
      payload: {
        total_revenue: stats.total_revenue,
        subscribers_by_plan: stats.subscribers_by_plan,
        total_active_subscribers: stats.total_active_subscribers,
      },
    };
  }
}
