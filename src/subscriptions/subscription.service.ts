import { Injectable, BadRequestException, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { 
  SubscriptionPlanEntity, 
  SubscriptionPlanTypeEnum, 
  BillingCycleEnum 
} from './entities/subscription-plan.entity';
import { 
  TeacherSubscriptionEntity, 
  SubscriptionStatusEnum 
} from './entities/teacher-subscription.entity';
import { 
  PaymentHistoryEntity, 
  PaymentStatusEnum 
} from './entities/payment-history.entity';
import { UpdatePlanPricingDto, UpdatePlanFeaturesDto } from './dto/update-plan-pricing.dto';
import { SubscribeDto, AdminAssignSubscriptionDto } from './dto/subscribe.dto';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';
import { UserEntity } from 'src/user/entities/user.entity';
import { RolesEnum } from 'src/common/enums/roles.enum';

@Injectable()
export class SubscriptionService implements OnModuleInit {
  constructor(
    @InjectRepository(SubscriptionPlanEntity)
    private readonly planRepo: Repository<SubscriptionPlanEntity>,

    @InjectRepository(TeacherSubscriptionEntity)
    private readonly subscriptionRepo: Repository<TeacherSubscriptionEntity>,

    @InjectRepository(PaymentHistoryEntity)
    private readonly paymentRepo: Repository<PaymentHistoryEntity>,

    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  /**
   * Seed default subscription plans on module initialization
   */
  async onModuleInit() {
    await this.seedPlans();
  }

  /**
   * Seed default subscription plans
   */
  private async seedPlans() {
    const existingPlans = await this.planRepo.find();
    if (existingPlans.length > 0) {
      return; // Plans already exist
    }

    const defaultPlans = [
      {
        plan_type: SubscriptionPlanTypeEnum.FREE,
        display_name: 'Free Plan',
        description: 'Basic access with limited features',
        price_monthly: 0,
        price_half_yearly: 0,
        price_yearly: 0,
        max_students_per_exam: 20,
        max_exams_per_month: 0, // Not applicable for free
        max_total_exams: 5,
        allows_subjective_exams: false,
        allows_images_in_questions: false,
        has_graphical_analytics: false,
        has_performance_graphs: false,
        has_browser_tracking: false,
        has_tab_tracking: false,
        has_video_proctoring: false,
        has_auto_disqualify: false,
        has_push_notifications: false,
        is_plan_active: true,
        sort_order: 1,
      },
      {
        plan_type: SubscriptionPlanTypeEnum.BASIC,
        display_name: 'Basic Plan',
        description: 'For individual teachers getting started',
        price_monthly: 100,
        price_half_yearly: 500,
        price_yearly: 1000,
        max_students_per_exam: 30,
        max_exams_per_month: 5,
        max_total_exams: 0, // Unlimited
        allows_subjective_exams: false,
        allows_images_in_questions: false,
        has_graphical_analytics: false,
        has_performance_graphs: false,
        has_browser_tracking: true,
        has_tab_tracking: false,
        has_video_proctoring: false,
        has_auto_disqualify: false,
        has_push_notifications: false,
        is_plan_active: true,
        sort_order: 2,
      },
      {
        plan_type: SubscriptionPlanTypeEnum.PREMIUM,
        display_name: 'Premium Plan',
        description: 'Most popular - Full features for serious educators',
        price_monthly: 300,
        price_half_yearly: 1650,
        price_yearly: 3000,
        max_students_per_exam: 80,
        max_exams_per_month: 15,
        max_total_exams: 0, // Unlimited
        allows_subjective_exams: true,
        allows_images_in_questions: true,
        has_graphical_analytics: true,
        has_performance_graphs: true,
        has_browser_tracking: true,
        has_tab_tracking: true,
        has_video_proctoring: false,
        has_auto_disqualify: false,
        has_push_notifications: false,
        is_plan_active: true,
        sort_order: 3,
      },
      {
        plan_type: SubscriptionPlanTypeEnum.PRO,
        display_name: 'Pro Plan',
        description: 'Enterprise-grade features for institutions',
        price_monthly: 500,
        price_half_yearly: 2800,
        price_yearly: 5000,
        max_students_per_exam: 200,
        max_exams_per_month: 0, // Unlimited
        max_total_exams: 0, // Unlimited
        allows_subjective_exams: true,
        allows_images_in_questions: true,
        has_graphical_analytics: true,
        has_performance_graphs: true,
        has_browser_tracking: true,
        has_tab_tracking: true,
        has_video_proctoring: true,
        has_auto_disqualify: true,
        has_push_notifications: true,
        is_plan_active: true,
        sort_order: 4,
      },
    ];

    for (const plan of defaultPlans) {
      await this.planRepo.save(this.planRepo.create(plan));
    }
    
    console.log('Subscription plans seeded successfully');
  }

  /**
   * Get all subscription plans
   */
  async getAllPlans(): Promise<SubscriptionPlanEntity[]> {
    return this.planRepo.find({
      where: { is_plan_active: true },
      order: { sort_order: 'ASC' },
    });
  }

  /**
   * Get a specific plan by type
   */
  async getPlanByType(planType: SubscriptionPlanTypeEnum): Promise<SubscriptionPlanEntity> {
    const plan = await this.planRepo.findOne({ where: { plan_type: planType } });
    if (!plan) {
      throw new NotFoundException(`Plan ${planType} not found`);
    }
    return plan;
  }

  /**
   * Update plan pricing (Admin only)
   */
  async updatePlanPricing(
    planType: SubscriptionPlanTypeEnum,
    dto: UpdatePlanPricingDto,
    jwtPayload: JwtPayloadInterface,
  ): Promise<SubscriptionPlanEntity> {
    const plan = await this.getPlanByType(planType);

    if (dto.price_monthly !== undefined) plan.price_monthly = dto.price_monthly;
    if (dto.price_half_yearly !== undefined) plan.price_half_yearly = dto.price_half_yearly;
    if (dto.price_yearly !== undefined) plan.price_yearly = dto.price_yearly;

    plan.updated_by = jwtPayload.id;
    plan.updated_user_name = `${jwtPayload.first_name} ${jwtPayload.last_name}`;
    plan.updated_at = new Date();

    return this.planRepo.save(plan);
  }

  /**
   * Update plan features (Admin only)
   */
  async updatePlanFeatures(
    planType: SubscriptionPlanTypeEnum,
    dto: UpdatePlanFeaturesDto,
    jwtPayload: JwtPayloadInterface,
  ): Promise<SubscriptionPlanEntity> {
    const plan = await this.getPlanByType(planType);

    // Update only provided fields
    Object.keys(dto).forEach((key) => {
      if (dto[key] !== undefined) {
        plan[key] = dto[key];
      }
    });

    plan.updated_by = jwtPayload.id;
    plan.updated_user_name = `${jwtPayload.first_name} ${jwtPayload.last_name}`;
    plan.updated_at = new Date();

    return this.planRepo.save(plan);
  }

  /**
   * Get teacher's current subscription
   */
  async getTeacherSubscription(teacherId: string): Promise<TeacherSubscriptionEntity | null> {
    // Check for active subscription
    const subscription = await this.subscriptionRepo.findOne({
      where: { 
        teacher_id: teacherId,
        status: SubscriptionStatusEnum.ACTIVE,
      },
      relations: ['plan'],
      order: { created_at: 'DESC' },
    });

    // Check if subscription is expired
    if (subscription && subscription.end_date && new Date(subscription.end_date) < new Date()) {
      subscription.status = SubscriptionStatusEnum.EXPIRED;
      await this.subscriptionRepo.save(subscription);
      return null;
    }

    return subscription;
  }

  /**
   * Get teacher's effective plan (returns FREE if no active subscription)
   */
  async getTeacherEffectivePlan(teacherId: string): Promise<SubscriptionPlanEntity> {
    const subscription = await this.getTeacherSubscription(teacherId);
    
    if (subscription) {
      return subscription.plan;
    }

    // Return free plan
    return this.getPlanByType(SubscriptionPlanTypeEnum.FREE);
  }

  /**
   * Subscribe to a plan
   */
  async subscribe(
    dto: SubscribeDto,
    jwtPayload: JwtPayloadInterface,
  ): Promise<TeacherSubscriptionEntity> {
    // Verify teacher role
    const user = await this.userRepo.findOne({ where: { id: jwtPayload.id } });
    if (!user || user.role !== RolesEnum.TEACHER) {
      throw new BadRequestException('Only teachers can subscribe to plans');
    }

    // Get the plan
    const plan = await this.getPlanByType(dto.plan_type);
    if (!plan.is_plan_active) {
      throw new BadRequestException('This plan is currently not available');
    }

    // Cancel existing subscription if any
    const existingSubscription = await this.getTeacherSubscription(jwtPayload.id);
    if (existingSubscription) {
      existingSubscription.status = SubscriptionStatusEnum.CANCELLED;
      await this.subscriptionRepo.save(existingSubscription);
    }

    // Calculate amount and end date
    let amount: number;
    let endDate: Date;
    const startDate = new Date();

    switch (dto.billing_cycle) {
      case BillingCycleEnum.MONTHLY:
        amount = plan.price_monthly;
        endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + 1);
        break;
      case BillingCycleEnum.HALF_YEARLY:
        amount = plan.price_half_yearly;
        endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + 6);
        break;
      case BillingCycleEnum.YEARLY:
        amount = plan.price_yearly;
        endDate = new Date(startDate);
        endDate.setFullYear(endDate.getFullYear() + 1);
        break;
    }

    // Create subscription entity
    const subscriptionData: Partial<TeacherSubscriptionEntity> = {
      teacher_id: jwtPayload.id,
      plan_id: plan.id,
      plan_type: dto.plan_type,
      billing_cycle: dto.billing_cycle,
      amount_paid: amount,
      status: dto.plan_type === SubscriptionPlanTypeEnum.FREE 
        ? SubscriptionStatusEnum.ACTIVE 
        : SubscriptionStatusEnum.PENDING, // Pending until payment confirmed
      start_date: startDate,
      exams_used_this_month: 0,
      total_exams_used: existingSubscription?.total_exams_used || 0,
      last_monthly_reset: new Date(),
      created_by: jwtPayload.id,
      created_user_name: `${jwtPayload.first_name} ${jwtPayload.last_name}`,
      created_at: new Date(),
    };

    // Only set end_date if not free plan
    if (dto.plan_type !== SubscriptionPlanTypeEnum.FREE && endDate) {
      subscriptionData.end_date = endDate;
    }

    const subscription = this.subscriptionRepo.create(subscriptionData);
    const savedSubscription = await this.subscriptionRepo.save(subscription);

    // Ensure we have a single entity (not array)
    const subscriptionEntity = Array.isArray(savedSubscription) 
      ? savedSubscription[0] 
      : savedSubscription;

    // Create payment record if not free
    if (dto.plan_type !== SubscriptionPlanTypeEnum.FREE && amount > 0) {
      const payment = this.paymentRepo.create({
        teacher_id: jwtPayload.id,
        subscription_id: subscriptionEntity.id,
        plan_type: dto.plan_type,
        billing_cycle: dto.billing_cycle,
        amount: amount,
        status: PaymentStatusEnum.PENDING,
        payment_method: dto.payment_method,
        transaction_id: dto.transaction_id,
        created_by: jwtPayload.id,
        created_user_name: `${jwtPayload.first_name} ${jwtPayload.last_name}`,
        created_at: new Date(),
      });

      await this.paymentRepo.save(payment);
    } else {
      // Free plan - activate immediately
      subscriptionEntity.status = SubscriptionStatusEnum.ACTIVE;
      await this.subscriptionRepo.save(subscriptionEntity);
    }

    const result = await this.subscriptionRepo.findOne({
      where: { id: subscriptionEntity.id },
      relations: ['plan'],
    });

    if (!result) {
      throw new BadRequestException('Failed to create subscription');
    }

    return result;
  }

  /**
   * Admin assign subscription to teacher
   */
  async adminAssignSubscription(
    dto: AdminAssignSubscriptionDto,
    jwtPayload: JwtPayloadInterface,
  ): Promise<TeacherSubscriptionEntity> {
    // Verify teacher exists
    const teacher = await this.userRepo.findOne({ where: { id: dto.teacher_id } });
    if (!teacher || teacher.role !== RolesEnum.TEACHER) {
      throw new BadRequestException('Teacher not found or user is not a teacher');
    }

    // Get the plan
    const plan = await this.getPlanByType(dto.plan_type);

    // Cancel existing subscription if any
    const existingSubscription = await this.getTeacherSubscription(dto.teacher_id);
    if (existingSubscription) {
      existingSubscription.status = SubscriptionStatusEnum.CANCELLED;
      await this.subscriptionRepo.save(existingSubscription);
    }

    // Calculate end date
    const startDate = new Date();
    let endDate: Date | null = null;
    let amount = 0;

    if (dto.billing_cycle) {
      switch (dto.billing_cycle) {
        case BillingCycleEnum.MONTHLY:
          amount = plan.price_monthly;
          endDate = new Date(startDate);
          endDate.setMonth(endDate.getMonth() + 1);
          break;
        case BillingCycleEnum.HALF_YEARLY:
          amount = plan.price_half_yearly;
          endDate = new Date(startDate);
          endDate.setMonth(endDate.getMonth() + 6);
          break;
        case BillingCycleEnum.YEARLY:
          amount = plan.price_yearly;
          endDate = new Date(startDate);
          endDate.setFullYear(endDate.getFullYear() + 1);
          break;
      }
    }

    // Create subscription (immediately active for admin assignments)
    const subscriptionData: Partial<TeacherSubscriptionEntity> = {
      teacher_id: dto.teacher_id,
      plan_id: plan.id,
      plan_type: dto.plan_type,
      billing_cycle: dto.billing_cycle,
      amount_paid: amount,
      status: SubscriptionStatusEnum.ACTIVE,
      start_date: startDate,
      exams_used_this_month: 0,
      total_exams_used: existingSubscription?.total_exams_used || 0,
      last_monthly_reset: new Date(),
      created_by: jwtPayload.id,
      created_user_name: `${jwtPayload.first_name} ${jwtPayload.last_name}`,
      created_at: new Date(),
    };

    // Only set end_date if provided
    if (endDate) {
      subscriptionData.end_date = endDate;
    }

    const subscription = this.subscriptionRepo.create(subscriptionData);
    const savedSubscription = await this.subscriptionRepo.save(subscription);

    // Ensure we have a single entity (not array)
    const subscriptionEntity = Array.isArray(savedSubscription) 
      ? savedSubscription[0] 
      : savedSubscription;

    // Create payment record
    if (amount > 0) {
      const payment = this.paymentRepo.create({
        teacher_id: dto.teacher_id,
        subscription_id: subscriptionEntity.id,
        plan_type: dto.plan_type,
        billing_cycle: dto.billing_cycle,
        amount: amount,
        status: PaymentStatusEnum.COMPLETED,
        payment_method: dto.payment_method,
        payment_date: new Date(),
        notes: dto.notes,
        created_by: jwtPayload.id,
        created_user_name: `${jwtPayload.first_name} ${jwtPayload.last_name}`,
        created_at: new Date(),
      });

      await this.paymentRepo.save(payment);
    }

    const result = await this.subscriptionRepo.findOne({
      where: { id: subscriptionEntity.id },
      relations: ['plan', 'teacher'],
    });

    if (!result) {
      throw new BadRequestException('Failed to create subscription');
    }

    return result;
  }

  /**
   * Confirm payment and activate subscription
   */
  async confirmPayment(
    paymentId: string,
    transactionId: string,
    jwtPayload: JwtPayloadInterface,
  ): Promise<PaymentHistoryEntity> {
    const payment = await this.paymentRepo.findOne({
      where: { id: paymentId },
      relations: ['subscription'],
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.status === PaymentStatusEnum.COMPLETED) {
      throw new BadRequestException('Payment already confirmed');
    }

    // Update payment
    payment.status = PaymentStatusEnum.COMPLETED;
    payment.transaction_id = transactionId;
    payment.payment_date = new Date();
    payment.updated_by = jwtPayload.id;
    payment.updated_user_name = `${jwtPayload.first_name} ${jwtPayload.last_name}`;
    payment.updated_at = new Date();

    await this.paymentRepo.save(payment);

    // Activate subscription
    if (payment.subscription) {
      payment.subscription.status = SubscriptionStatusEnum.ACTIVE;
      await this.subscriptionRepo.save(payment.subscription);
    }

    return payment;
  }

  /**
   * Get payment history for a teacher
   */
  async getPaymentHistory(teacherId: string): Promise<PaymentHistoryEntity[]> {
    return this.paymentRepo.find({
      where: { teacher_id: teacherId },
      relations: ['subscription'],
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Check if teacher can create an exam based on subscription limits
   */
  async canCreateExam(teacherId: string): Promise<{ allowed: boolean; reason?: string }> {
    const subscription = await this.getTeacherSubscription(teacherId);
    const plan = subscription ? subscription.plan : await this.getPlanByType(SubscriptionPlanTypeEnum.FREE);

    // Check total exam limit
    if (plan.max_total_exams > 0) {
      const totalExams = subscription?.total_exams_used || 0;
      if (totalExams >= plan.max_total_exams) {
        return {
          allowed: false,
          reason: `You have reached your total exam limit (${plan.max_total_exams}). Please upgrade your plan.`,
        };
      }
    }

    // Check monthly exam limit
    if (plan.max_exams_per_month > 0 && subscription) {
      // Check if we need to reset monthly count
      const now = new Date();
      const lastReset = subscription.last_monthly_reset;
      
      if (lastReset) {
        const monthDiff = (now.getFullYear() - lastReset.getFullYear()) * 12 + 
                         (now.getMonth() - lastReset.getMonth());
        
        if (monthDiff >= 1) {
          // Reset monthly count
          subscription.exams_used_this_month = 0;
          subscription.last_monthly_reset = now;
          await this.subscriptionRepo.save(subscription);
        }
      }

      if (subscription.exams_used_this_month >= plan.max_exams_per_month) {
        return {
          allowed: false,
          reason: `You have reached your monthly exam limit (${plan.max_exams_per_month}). Please wait until next month or upgrade your plan.`,
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Increment exam count when exam is created
   */
  async incrementExamCount(teacherId: string): Promise<void> {
    const subscription = await this.getTeacherSubscription(teacherId);
    if (subscription) {
      subscription.exams_used_this_month += 1;
      subscription.total_exams_used += 1;
      await this.subscriptionRepo.save(subscription);
    }
  }

  /**
   * Get all subscriptions (Admin)
   */
  async getAllSubscriptions(): Promise<TeacherSubscriptionEntity[]> {
    return this.subscriptionRepo.find({
      relations: ['teacher', 'plan'],
      order: { created_at: 'DESC' },
    });
  }
}
