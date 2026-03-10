import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
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
import { SubscriptionPlanTypeEnum } from './entities/subscription-plan.entity';
import { UpdatePlanPricingDto, UpdatePlanFeaturesDto } from './dto/update-plan-pricing.dto';
import { SubscribeDto, AdminAssignSubscriptionDto } from './dto/subscribe.dto';

@ApiTags('Subscriptions')
@Controller({
  path: 'subscriptions',
  version: '1',
})
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  // ========================
  // PUBLIC ENDPOINTS
  // ========================

  @Get('plans')
  @ApiOperation({
    summary: 'Get all subscription plans',
    description: 'Returns all active subscription plans with pricing and features. No authentication required.',
  })
  @ApiResponse({ status: 200, description: 'List of subscription plans' })
  async getAllPlans() {
    const payload = await this.subscriptionService.getAllPlans();
    return { message: 'Subscription plans retrieved successfully', payload };
  }

  @Get('plans/:planType')
  @ApiOperation({
    summary: 'Get a specific subscription plan',
    description: 'Returns details of a specific subscription plan by type',
  })
  @ApiParam({ 
    name: 'planType', 
    enum: SubscriptionPlanTypeEnum,
    description: 'Type of the subscription plan' 
  })
  @ApiResponse({ status: 200, description: 'Plan details' })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  async getPlanByType(@Param('planType') planType: SubscriptionPlanTypeEnum) {
    const payload = await this.subscriptionService.getPlanByType(planType);
    return { message: 'Plan retrieved successfully', payload };
  }

  // ========================
  // TEACHER ENDPOINTS
  // ========================

  @Get('my-subscription')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.TEACHER)
  @ApiOperation({
    summary: 'Get current teacher subscription',
    description: 'Returns the current subscription details for the logged-in teacher',
  })
  @ApiResponse({ status: 200, description: 'Current subscription details' })
  async getMySubscription(@UserPayload() jwtPayload: JwtPayloadInterface) {
    const payload = await this.subscriptionService.getTeacherSubscription(jwtPayload.id);
    return { 
      message: payload ? 'Subscription retrieved successfully' : 'No active subscription', 
      payload 
    };
  }

  @Get('my-effective-plan')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.TEACHER)
  @ApiOperation({
    summary: 'Get effective plan for teacher',
    description: 'Returns the effective plan (current subscription or FREE plan if no subscription)',
  })
  @ApiResponse({ status: 200, description: 'Effective plan details' })
  async getMyEffectivePlan(@UserPayload() jwtPayload: JwtPayloadInterface) {
    const payload = await this.subscriptionService.getTeacherEffectivePlan(jwtPayload.id);
    return { message: 'Effective plan retrieved successfully', payload };
  }

  @Post('subscribe')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.TEACHER)
  @ApiOperation({
    summary: 'Subscribe to a plan',
    description: 'Subscribe to a subscription plan. For paid plans, payment will need to be confirmed.',
  })
  @ApiResponse({ status: 201, description: 'Subscription created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async subscribe(
    @Body() dto: SubscribeDto,
    @UserPayload() jwtPayload: JwtPayloadInterface,
  ) {
    const payload = await this.subscriptionService.subscribe(dto, jwtPayload);
    return { message: 'Subscription created successfully', payload };
  }

  @Get('my-payment-history')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.TEACHER)
  @ApiOperation({
    summary: 'Get payment history',
    description: 'Returns payment history for the logged-in teacher',
  })
  @ApiResponse({ status: 200, description: 'Payment history' })
  async getMyPaymentHistory(@UserPayload() jwtPayload: JwtPayloadInterface) {
    const payload = await this.subscriptionService.getPaymentHistory(jwtPayload.id);
    return { message: 'Payment history retrieved successfully', payload };
  }

  @Get('can-create-exam')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.TEACHER)
  @ApiOperation({
    summary: 'Check if teacher can create exam',
    description: 'Checks subscription limits to determine if teacher can create a new exam',
  })
  @ApiResponse({ status: 200, description: 'Exam creation eligibility status' })
  async canCreateExam(@UserPayload() jwtPayload: JwtPayloadInterface) {
    const payload = await this.subscriptionService.canCreateExam(jwtPayload.id);
    return { message: 'Eligibility check completed', payload };
  }

  // ========================
  // ADMIN ENDPOINTS
  // ========================

  @Patch('plans/:planType/pricing')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Update plan pricing',
    description: 'Update the pricing for a subscription plan. Admin/SuperAdmin only.',
  })
  @ApiParam({ 
    name: 'planType', 
    enum: SubscriptionPlanTypeEnum,
    description: 'Type of the subscription plan to update' 
  })
  @ApiResponse({ status: 200, description: 'Plan pricing updated' })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  async updatePlanPricing(
    @Param('planType') planType: SubscriptionPlanTypeEnum,
    @Body() dto: UpdatePlanPricingDto,
    @UserPayload() jwtPayload: JwtPayloadInterface,
  ) {
    const payload = await this.subscriptionService.updatePlanPricing(planType, dto, jwtPayload);
    return { message: 'Plan pricing updated successfully', payload };
  }

  @Patch('plans/:planType/features')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Update plan features',
    description: 'Update the features and limits for a subscription plan. Admin/SuperAdmin only.',
  })
  @ApiParam({ 
    name: 'planType', 
    enum: SubscriptionPlanTypeEnum,
    description: 'Type of the subscription plan to update' 
  })
  @ApiResponse({ status: 200, description: 'Plan features updated' })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  async updatePlanFeatures(
    @Param('planType') planType: SubscriptionPlanTypeEnum,
    @Body() dto: UpdatePlanFeaturesDto,
    @UserPayload() jwtPayload: JwtPayloadInterface,
  ) {
    const payload = await this.subscriptionService.updatePlanFeatures(planType, dto, jwtPayload);
    return { message: 'Plan features updated successfully', payload };
  }

  @Post('admin/assign')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Assign subscription to teacher',
    description: 'Admin can assign a subscription plan to a teacher directly. Useful for complimentary subscriptions or manual processing.',
  })
  @ApiResponse({ status: 201, description: 'Subscription assigned' })
  @ApiResponse({ status: 400, description: 'Validation error or teacher not found' })
  async adminAssignSubscription(
    @Body() dto: AdminAssignSubscriptionDto,
    @UserPayload() jwtPayload: JwtPayloadInterface,
  ) {
    const payload = await this.subscriptionService.adminAssignSubscription(dto, jwtPayload);
    return { message: 'Subscription assigned successfully', payload };
  }

  @Patch('admin/confirm-payment/:paymentId')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Confirm payment',
    description: 'Admin can confirm a pending payment and activate the subscription',
  })
  @ApiParam({ name: 'paymentId', description: 'Payment UUID' })
  @ApiResponse({ status: 200, description: 'Payment confirmed and subscription activated' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
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
  @ApiOperation({
    summary: 'Get all subscriptions',
    description: 'Returns all teacher subscriptions. Admin only.',
  })
  @ApiResponse({ status: 200, description: 'List of all subscriptions' })
  async getAllSubscriptions() {
    const payload = await this.subscriptionService.getAllSubscriptions();
    return { message: 'Subscriptions retrieved successfully', payload };
  }

  @Get('admin/teacher/:teacherId/subscription')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Get teacher subscription',
    description: 'Get subscription details for a specific teacher. Admin only.',
  })
  @ApiParam({ name: 'teacherId', description: 'Teacher UUID' })
  @ApiResponse({ status: 200, description: 'Teacher subscription details' })
  async getTeacherSubscription(@Param('teacherId', ParseUUIDPipe) teacherId: string) {
    const payload = await this.subscriptionService.getTeacherSubscription(teacherId);
    return { 
      message: payload ? 'Subscription retrieved successfully' : 'No active subscription', 
      payload 
    };
  }

  @Get('admin/teacher/:teacherId/payment-history')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Get teacher payment history',
    description: 'Get payment history for a specific teacher. Admin only.',
  })
  @ApiParam({ name: 'teacherId', description: 'Teacher UUID' })
  @ApiResponse({ status: 200, description: 'Teacher payment history' })
  async getTeacherPaymentHistory(@Param('teacherId', ParseUUIDPipe) teacherId: string) {
    const payload = await this.subscriptionService.getPaymentHistory(teacherId);
    return { message: 'Payment history retrieved successfully', payload };
  }
}
