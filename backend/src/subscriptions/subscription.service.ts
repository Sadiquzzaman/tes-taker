import {
  Injectable,
  BadRequestException,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  SubscriptionPlanEntity,
  BillingCycleEnum,
  PlanVisibilityEnum,
} from './entities/subscription-plan.entity';
import {
  TeacherSubscriptionEntity,
  SubscriptionStatusEnum,
} from './entities/teacher-subscription.entity';
import {
  PaymentHistoryEntity,
  PaymentStatusEnum,
} from './entities/payment-history.entity';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';
import { UserEntity } from 'src/user/entities/user.entity';
import { RolesEnum } from 'src/common/enums/roles.enum';
import {
  SEED_PLAN_PRESETS,
  validateFeaturesInput,
  validateLimitsInput,
  mergeFeatures,
  mergeLimits,
} from './constants/feature-catalog';
import {
  AssignPlanDto,
  ChangePlanDto,
  CreatePlanDto,
  GrantTempAccessDto,
  ReorderPlansDto,
  SubscribeByPlanIdDto,
  SubscriptionOverridesDto,
  UpdatePlanDto,
} from './dto/plan-management.dto';
import { PaymentMethodEnum } from './entities/payment-history.entity';

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

  async onModuleInit() {
    await this.seedPlans();
  }

  private async seedPlans() {
    for (const preset of Object.values(SEED_PLAN_PRESETS)) {
      const existing = await this.planRepo.findOne({ where: { slug: preset.slug } });
      const planData = {
        name: preset.name,
        slug: preset.slug,
        description: preset.description,
        price_monthly: preset.price_monthly,
        price_half_yearly: preset.price_half_yearly,
        price_yearly: preset.price_yearly,
        features: mergeFeatures(preset.features),
        limits: mergeLimits(preset.limits),
        is_plan_active: true,
        sort_order: preset.sort_order,
        is_custom: false,
        visibility: PlanVisibilityEnum.PUBLIC,
      };

      if (existing) {
        Object.assign(existing, planData);
        await this.planRepo.save(existing);
      } else {
        await this.planRepo.save(this.planRepo.create(planData));
      }
    }
    console.log('Subscription plans seeded/updated successfully');
  }

  async getAllPlans(includeHidden = false): Promise<SubscriptionPlanEntity[]> {
    const where = includeHidden
      ? {}
      : { is_plan_active: true, visibility: PlanVisibilityEnum.PUBLIC };

    return this.planRepo.find({
      where,
      order: { sort_order: 'ASC' },
    });
  }

  async getAllPlansAdmin(): Promise<SubscriptionPlanEntity[]> {
    return this.planRepo.find({ order: { sort_order: 'ASC' } });
  }

  async getPlanById(planId: string): Promise<SubscriptionPlanEntity> {
    const plan = await this.planRepo.findOne({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Plan not found');
    return plan;
  }

  async getPlanBySlug(slug: string): Promise<SubscriptionPlanEntity> {
    const plan = await this.planRepo.findOne({ where: { slug } });
    if (!plan) throw new NotFoundException(`Plan "${slug}" not found`);
    return plan;
  }

  async createPlan(dto: CreatePlanDto, jwtPayload: JwtPayloadInterface): Promise<SubscriptionPlanEntity> {
    const existing = await this.planRepo.findOne({ where: { slug: dto.slug } });
    if (existing) throw new BadRequestException('Plan slug already exists');

    const plan = this.planRepo.create({
      name: dto.name,
      slug: dto.slug,
      description: dto.description,
      price_monthly: dto.price_monthly ?? 0,
      price_half_yearly: dto.price_half_yearly ?? 0,
      price_yearly: dto.price_yearly ?? 0,
      features: mergeFeatures(validateFeaturesInput(dto.features ?? {})),
      limits: mergeLimits(validateLimitsInput(dto.limits ?? {})),
      visibility: dto.visibility ?? PlanVisibilityEnum.PUBLIC,
      is_custom: dto.is_custom ?? false,
      sort_order: dto.sort_order ?? 0,
      is_plan_active: true,
      created_by: jwtPayload.id,
      created_user_name: jwtPayload.full_name,
      created_at: new Date(),
    });

    return this.planRepo.save(plan);
  }

  async updatePlan(
    planId: string,
    dto: UpdatePlanDto,
    jwtPayload: JwtPayloadInterface,
  ): Promise<SubscriptionPlanEntity> {
    const plan = await this.getPlanById(planId);

    if (dto.slug && dto.slug !== plan.slug) {
      const slugTaken = await this.planRepo.findOne({ where: { slug: dto.slug } });
      if (slugTaken) throw new BadRequestException('Plan slug already exists');
      plan.slug = dto.slug;
    }

    if (dto.name !== undefined) plan.name = dto.name;
    if (dto.description !== undefined) plan.description = dto.description;
    if (dto.price_monthly !== undefined) plan.price_monthly = dto.price_monthly;
    if (dto.price_half_yearly !== undefined) plan.price_half_yearly = dto.price_half_yearly;
    if (dto.price_yearly !== undefined) plan.price_yearly = dto.price_yearly;
    if (dto.visibility !== undefined) plan.visibility = dto.visibility;
    if (dto.is_custom !== undefined) plan.is_custom = dto.is_custom;
    if (dto.sort_order !== undefined) plan.sort_order = dto.sort_order;
    if (dto.is_plan_active !== undefined) plan.is_plan_active = dto.is_plan_active;

    if (dto.features) {
      plan.features = mergeFeatures(plan.features, validateFeaturesInput(dto.features));
    }
    if (dto.limits) {
      plan.limits = mergeLimits(plan.limits, validateLimitsInput(dto.limits));
    }

    plan.updated_by = jwtPayload.id;
    plan.updated_user_name = jwtPayload.full_name;
    plan.updated_at = new Date();

    return this.planRepo.save(plan);
  }

  async deletePlan(planId: string): Promise<void> {
    const plan = await this.getPlanById(planId);
    const activeSubs = await this.subscriptionRepo.count({
      where: { plan_id: plan.id, status: SubscriptionStatusEnum.ACTIVE },
    });
    if (activeSubs > 0) {
      throw new BadRequestException('Cannot delete plan with active subscriptions');
    }
    await this.planRepo.remove(plan);
  }

  async clonePlan(planId: string, jwtPayload: JwtPayloadInterface): Promise<SubscriptionPlanEntity> {
    const source = await this.getPlanById(planId);
    const slug = `${source.slug}-copy-${Date.now()}`;

    return this.createPlan(
      {
        name: `${source.name} (Copy)`,
        slug,
        description: source.description,
        price_monthly: Number(source.price_monthly),
        price_half_yearly: Number(source.price_half_yearly),
        price_yearly: Number(source.price_yearly),
        features: source.features,
        limits: source.limits,
        visibility: source.visibility,
        is_custom: source.is_custom,
        sort_order: source.sort_order + 1,
      },
      jwtPayload,
    );
  }

  async reorderPlans(dto: ReorderPlansDto): Promise<SubscriptionPlanEntity[]> {
    for (let i = 0; i < dto.plan_ids.length; i++) {
      await this.planRepo.update({ id: dto.plan_ids[i] }, { sort_order: i + 1 });
    }
    return this.getAllPlansAdmin();
  }

  async setPlanActive(planId: string, active: boolean): Promise<SubscriptionPlanEntity> {
    const plan = await this.getPlanById(planId);
    plan.is_plan_active = active;
    return this.planRepo.save(plan);
  }

  async getTeacherSubscription(teacherId: string): Promise<TeacherSubscriptionEntity | null> {
    const subscription = await this.subscriptionRepo.findOne({
      where: { teacher_id: teacherId, status: SubscriptionStatusEnum.ACTIVE },
      relations: ['plan'],
      order: { created_at: 'DESC' },
    });

    if (subscription?.end_date && new Date(subscription.end_date) < new Date()) {
      subscription.status = SubscriptionStatusEnum.EXPIRED;
      await this.subscriptionRepo.save(subscription);
      return null;
    }

    return subscription;
  }

  async provisionFreePlan(teacherId: string, actorName = 'System'): Promise<TeacherSubscriptionEntity> {
    const existing = await this.getTeacherSubscription(teacherId);
    if (existing) return existing;

    const freePlan = await this.getPlanBySlug('free');

    const subscription = this.subscriptionRepo.create({
      teacher_id: teacherId,
      plan_id: freePlan.id,
      billing_cycle: undefined,
      amount_paid: 0,
      status: SubscriptionStatusEnum.ACTIVE,
      start_date: new Date(),
      exams_used_this_month: 0,
      total_exams_used: 0,
      last_monthly_reset: new Date(),
      created_user_name: actorName,
      created_at: new Date(),
    });

    return this.subscriptionRepo.save(subscription);
  }

  private calculateBilling(plan: SubscriptionPlanEntity, cycle: BillingCycleEnum) {
    let amount: number;
    let endDate: Date;
    const startDate = new Date();

    switch (cycle) {
      case BillingCycleEnum.MONTHLY:
        amount = Number(plan.price_monthly);
        endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + 1);
        break;
      case BillingCycleEnum.HALF_YEARLY:
        amount = Number(plan.price_half_yearly);
        endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + 6);
        break;
      case BillingCycleEnum.YEARLY:
        amount = Number(plan.price_yearly);
        endDate = new Date(startDate);
        endDate.setFullYear(endDate.getFullYear() + 1);
        break;
    }

    return { amount, endDate, startDate };
  }

  private async cancelActiveSubscription(teacherId: string): Promise<TeacherSubscriptionEntity | null> {
    const existing = await this.getTeacherSubscription(teacherId);
    if (existing) {
      existing.status = SubscriptionStatusEnum.CANCELLED;
      await this.subscriptionRepo.save(existing);
    }
    return existing;
  }

  async subscribe(
    dto: SubscribeByPlanIdDto,
    jwtPayload: JwtPayloadInterface,
  ): Promise<TeacherSubscriptionEntity> {
    const user = await this.userRepo.findOne({ where: { id: jwtPayload.id } });
    if (!user || user.role !== RolesEnum.TEACHER) {
      throw new BadRequestException('Only teachers can subscribe to plans');
    }

    const plan = await this.getPlanById(dto.plan_id);
    if (!plan.is_plan_active) {
      throw new BadRequestException('This plan is currently not available');
    }

    const existingSubscription = await this.cancelActiveSubscription(jwtPayload.id);
    const { amount, endDate, startDate } = this.calculateBilling(plan, dto.billing_cycle);
    const isFree = amount === 0;

    const subscription = this.subscriptionRepo.create({
      teacher_id: jwtPayload.id,
      plan_id: plan.id,
      billing_cycle: dto.billing_cycle,
      amount_paid: amount,
      status: isFree ? SubscriptionStatusEnum.ACTIVE : SubscriptionStatusEnum.PENDING,
      start_date: startDate,
      end_date: isFree ? undefined : endDate,
      exams_used_this_month: 0,
      total_exams_used: existingSubscription?.total_exams_used ?? 0,
      last_monthly_reset: new Date(),
      created_by: jwtPayload.id,
      created_user_name: jwtPayload.full_name,
      created_at: new Date(),
    });

    const saved = await this.subscriptionRepo.save(subscription);

    if (!isFree && amount > 0) {
      await this.paymentRepo.save(
        this.paymentRepo.create({
          teacher_id: jwtPayload.id,
          subscription_id: saved.id,
          plan_id: plan.id,
          billing_cycle: dto.billing_cycle,
          amount,
          status: PaymentStatusEnum.PENDING,
          payment_method: dto.payment_method,
          transaction_id: dto.transaction_id,
          created_by: jwtPayload.id,
          created_user_name: jwtPayload.full_name,
          created_at: new Date(),
        }),
      );
    }

    const result = await this.subscriptionRepo.findOne({
      where: { id: saved.id },
      relations: ['plan'],
    });

    if (!result) throw new BadRequestException('Failed to create subscription');
    return result;
  }

  async assignPlan(dto: AssignPlanDto, jwtPayload: JwtPayloadInterface): Promise<TeacherSubscriptionEntity> {
    const teacher = await this.userRepo.findOne({ where: { id: dto.teacher_id } });
    if (!teacher || teacher.role !== RolesEnum.TEACHER) {
      throw new BadRequestException('Teacher not found');
    }

    const plan = await this.getPlanById(dto.plan_id);
    const existingSubscription = await this.cancelActiveSubscription(dto.teacher_id);

    let amount = 0;
    let endDate: Date | undefined;
    const startDate = new Date();

    if (dto.billing_cycle) {
      const billing = this.calculateBilling(plan, dto.billing_cycle);
      amount = billing.amount;
      endDate = billing.endDate;
    }

    const subscription = this.subscriptionRepo.create({
      teacher_id: dto.teacher_id,
      plan_id: plan.id,
      billing_cycle: dto.billing_cycle,
      amount_paid: amount,
      status: SubscriptionStatusEnum.ACTIVE,
      start_date: startDate,
      end_date: endDate,
      exams_used_this_month: 0,
      total_exams_used: existingSubscription?.total_exams_used ?? 0,
      last_monthly_reset: new Date(),
      created_by: jwtPayload.id,
      created_user_name: jwtPayload.full_name,
      created_at: new Date(),
    });

    const saved = await this.subscriptionRepo.save(subscription);

    if (amount > 0) {
      await this.paymentRepo.save(
        this.paymentRepo.create({
          teacher_id: dto.teacher_id,
          subscription_id: saved.id,
          plan_id: plan.id,
          billing_cycle: dto.billing_cycle,
          amount,
          status: PaymentStatusEnum.COMPLETED,
          payment_method: dto.payment_method ?? PaymentMethodEnum.MANUAL,
          payment_date: new Date(),
          notes: dto.notes,
          created_by: jwtPayload.id,
          created_user_name: jwtPayload.full_name,
          created_at: new Date(),
        }),
      );
    }

    const result = await this.subscriptionRepo.findOne({
      where: { id: saved.id },
      relations: ['plan', 'teacher'],
    });

    if (!result) throw new BadRequestException('Failed to assign subscription');
    return result;
  }

  async upgradePlan(dto: ChangePlanDto, jwtPayload: JwtPayloadInterface): Promise<TeacherSubscriptionEntity> {
    return this.subscribe(
      {
        plan_id: dto.plan_id,
        billing_cycle: dto.billing_cycle,
        payment_method: dto.payment_method,
      },
      jwtPayload,
    );
  }

  async downgradePlan(dto: ChangePlanDto, jwtPayload: JwtPayloadInterface): Promise<TeacherSubscriptionEntity> {
    return this.subscribe(
      {
        plan_id: dto.plan_id,
        billing_cycle: dto.billing_cycle,
        payment_method: dto.payment_method,
      },
      jwtPayload,
    );
  }

  async forceChangePlan(
    teacherId: string,
    dto: ChangePlanDto,
    jwtPayload: JwtPayloadInterface,
  ): Promise<TeacherSubscriptionEntity> {
    return this.assignPlan(
      {
        teacher_id: teacherId,
        plan_id: dto.plan_id,
        billing_cycle: dto.billing_cycle,
        payment_method: dto.payment_method,
        notes: 'Force changed by super-admin',
      },
      jwtPayload,
    );
  }

  async cancelSubscription(teacherId: string): Promise<TeacherSubscriptionEntity | null> {
    const subscription = await this.cancelActiveSubscription(teacherId);
    if (subscription) {
      await this.provisionFreePlan(teacherId);
    }
    return subscription;
  }

  async setSubscriptionOverrides(
    teacherId: string,
    dto: SubscriptionOverridesDto,
  ): Promise<TeacherSubscriptionEntity> {
    const subscription = await this.getTeacherSubscription(teacherId);
    if (!subscription) throw new NotFoundException('No active subscription found');

    subscription.overrides = {
      features: dto.features ? validateFeaturesInput(dto.features) : subscription.overrides?.features,
      limits: dto.limits ? validateLimitsInput(dto.limits) : subscription.overrides?.limits,
      expires_at: dto.expires_at ?? subscription.overrides?.expires_at,
    };

    return this.subscriptionRepo.save(subscription);
  }

  async grantTempAccess(dto: GrantTempAccessDto, jwtPayload: JwtPayloadInterface): Promise<TeacherSubscriptionEntity> {
    if (dto.plan_id) {
      await this.assignPlan(
        {
          teacher_id: dto.teacher_id,
          plan_id: dto.plan_id,
          billing_cycle: BillingCycleEnum.MONTHLY,
          notes: 'Temporary access grant',
        },
        jwtPayload,
      );
    }

    return this.setSubscriptionOverrides(dto.teacher_id, {
      features: dto.features,
      limits: dto.limits,
      expires_at: dto.expires_at,
    });
  }

  async activateSubscriptionFromPayment(
    subscriptionId: string,
    transactionId: string,
    amount: number,
    gatewayReference?: string,
  ): Promise<TeacherSubscriptionEntity> {
    const subscription = await this.subscriptionRepo.findOne({
      where: { id: subscriptionId },
      relations: ['plan'],
    });

    if (!subscription) throw new NotFoundException('Subscription not found');

    subscription.status = SubscriptionStatusEnum.ACTIVE;
    subscription.amount_paid = amount;
    await this.subscriptionRepo.save(subscription);

    await this.paymentRepo.save(
      this.paymentRepo.create({
        teacher_id: subscription.teacher_id,
        subscription_id: subscription.id,
        plan_id: subscription.plan_id,
        billing_cycle: subscription.billing_cycle,
        amount,
        status: PaymentStatusEnum.COMPLETED,
        payment_method: PaymentMethodEnum.CARD,
        transaction_id: transactionId,
        gateway_reference: gatewayReference,
        payment_date: new Date(),
        created_at: new Date(),
      }),
    );

    return subscription;
  }

  async confirmPayment(
    paymentId: string,
    transactionId: string,
    jwtPayload: JwtPayloadInterface,
  ): Promise<PaymentHistoryEntity> {
    const payment = await this.paymentRepo.findOne({
      where: { id: paymentId },
      relations: ['subscription'],
    });

    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status === PaymentStatusEnum.COMPLETED) {
      throw new BadRequestException('Payment already confirmed');
    }

    payment.status = PaymentStatusEnum.COMPLETED;
    payment.transaction_id = transactionId;
    payment.payment_date = new Date();
    payment.updated_by = jwtPayload.id;
    payment.updated_user_name = jwtPayload.full_name;
    payment.updated_at = new Date();

    await this.paymentRepo.save(payment);

    if (payment.subscription) {
      payment.subscription.status = SubscriptionStatusEnum.ACTIVE;
      await this.subscriptionRepo.save(payment.subscription);
    }

    return payment;
  }

  async getPaymentHistory(teacherId: string): Promise<PaymentHistoryEntity[]> {
    return this.paymentRepo.find({
      where: { teacher_id: teacherId },
      relations: ['subscription'],
      order: { created_at: 'DESC' },
    });
  }

  async incrementExamCount(teacherId: string): Promise<void> {
    const subscription = await this.getTeacherSubscription(teacherId);
    if (subscription) {
      subscription.exams_used_this_month += 1;
      subscription.total_exams_used += 1;
      await this.subscriptionRepo.save(subscription);
    }
  }

  async getAllSubscriptions(): Promise<TeacherSubscriptionEntity[]> {
    return this.subscriptionRepo.find({
      relations: ['teacher', 'plan'],
      order: { created_at: 'DESC' },
    });
  }

  // Admin stats
  async getAdminStats() {
    const [plans, subscriptions, payments] = await Promise.all([
      this.planRepo.find(),
      this.subscriptionRepo.find({ where: { status: SubscriptionStatusEnum.ACTIVE }, relations: ['plan'] }),
      this.paymentRepo.find({ where: { status: PaymentStatusEnum.COMPLETED } }),
    ]);

    const subscribersByPlan = plans.map((plan) => ({
      plan_id: plan.id,
      plan_name: plan.name,
      slug: plan.slug,
      count: subscriptions.filter((s) => s.plan_id === plan.id).length,
    }));

    const revenue = payments.reduce((sum, p) => sum + Number(p.amount), 0);

    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const expiring = subscriptions.filter(
      (s) => s.end_date && new Date(s.end_date) <= thirtyDaysFromNow && new Date(s.end_date) > new Date(),
    );

    return {
      total_active_subscribers: subscriptions.length,
      subscribers_by_plan: subscribersByPlan,
      total_revenue: revenue,
      expiring_count: expiring.length,
      expiring_subscriptions: expiring,
    };
  }

  async getAdminPayments(page = 1, limit = 20) {
    const [items, total] = await this.paymentRepo.findAndCount({
      relations: ['teacher', 'subscription'],
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { items, total, page, limit };
  }
}
