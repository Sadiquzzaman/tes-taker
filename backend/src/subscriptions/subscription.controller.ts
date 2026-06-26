import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
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
import {
  AssignPlanDto,
  ChangePlanDto,
  CreatePlanDto,
  GrantTempAccessDto,
  ReorderPlansDto,
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

  @Get('my-subscription')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.TEACHER)
  async getMySubscription(@UserPayload() jwtPayload: JwtPayloadInterface) {
    const payload = await this.subscriptionService.getTeacherSubscription(jwtPayload.id);
    return {
      message: payload ? 'Subscription retrieved successfully' : 'No active subscription',
      payload,
    };
  }

  @Get('my-entitlements')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.TEACHER)
  async getMyEntitlements(@UserPayload() jwtPayload: JwtPayloadInterface) {
    const payload = await this.entitlementsService.getEntitlements(jwtPayload.id);
    return { message: 'Entitlements retrieved successfully', payload };
  }

  @Post('subscribe')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.TEACHER)
  async subscribe(
    @Body() dto: SubscribeByPlanIdDto,
    @UserPayload() jwtPayload: JwtPayloadInterface,
  ) {
    const payload = await this.subscriptionService.subscribe(dto, jwtPayload);
    return { message: 'Subscription created successfully', payload };
  }

  @Post('upgrade')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.TEACHER)
  async upgrade(
    @Body() dto: ChangePlanDto,
    @UserPayload() jwtPayload: JwtPayloadInterface,
  ) {
    const payload = await this.subscriptionService.upgradePlan(dto, jwtPayload);
    return { message: 'Plan upgraded successfully', payload };
  }

  @Post('downgrade')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.TEACHER)
  async downgrade(
    @Body() dto: ChangePlanDto,
    @UserPayload() jwtPayload: JwtPayloadInterface,
  ) {
    const payload = await this.subscriptionService.downgradePlan(dto, jwtPayload);
    return { message: 'Plan downgraded successfully', payload };
  }

  @Post('cancel')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.TEACHER)
  async cancel(@UserPayload() jwtPayload: JwtPayloadInterface) {
    const payload = await this.subscriptionService.cancelSubscription(jwtPayload.id);
    return { message: 'Subscription cancelled', payload };
  }

  @Get('my-payment-history')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.TEACHER)
  async getMyPaymentHistory(@UserPayload() jwtPayload: JwtPayloadInterface) {
    const payload = await this.subscriptionService.getPaymentHistory(jwtPayload.id);
    return { message: 'Payment history retrieved successfully', payload };
  }

  @Get('can-create-exam')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.TEACHER)
  async canCreateExam(@UserPayload() jwtPayload: JwtPayloadInterface) {
    const payload = await this.entitlementsService.canCreateExam(jwtPayload.id);
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
  async deletePlan(@Param('planId', ParseUUIDPipe) planId: string) {
    await this.subscriptionService.deletePlan(planId);
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
  async reorderPlans(@Body() dto: ReorderPlansDto) {
    const payload = await this.subscriptionService.reorderPlans(dto);
    return { message: 'Plans reordered successfully', payload };
  }

  @Patch('admin/plans/:planId/activate')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  async activatePlan(@Param('planId', ParseUUIDPipe) planId: string) {
    const payload = await this.subscriptionService.setPlanActive(planId, true);
    return { message: 'Plan activated successfully', payload };
  }

  @Patch('admin/plans/:planId/deactivate')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  async deactivatePlan(@Param('planId', ParseUUIDPipe) planId: string) {
    const payload = await this.subscriptionService.setPlanActive(planId, false);
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
    const payload = await this.subscriptionService.getTeacherSubscription(teacherId);
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
    const payload = await this.subscriptionService.getPaymentHistory(teacherId);
    return { message: 'Payment history retrieved successfully', payload };
  }

  @Patch('admin/teacher/:teacherId/status')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  async setTeacherActive(
    @Param('teacherId', ParseUUIDPipe) teacherId: string,
    @Body() dto: SetTeacherActiveDto,
  ) {
    const payload = await this.subscriptionService.setTeacherActive(teacherId, dto.active);
    return {
      message: dto.active ? 'Teacher enabled successfully' : 'Teacher disabled successfully',
      payload,
    };
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
  ) {
    const payload = await this.subscriptionService.setSubscriptionOverrides(teacherId, dto);
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
