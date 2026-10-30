import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AUDIT_ACTIONS } from 'src/audit/audit-actions';
import { auditChanges } from 'src/audit/audit-sanitize';
import { AuditService } from 'src/audit/audit.service';
import { EntityManager, In, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { resolveFrontendUrl } from 'src/common/utils/frontend-url.util';
import { NOTIFICATION_EVENTS, NotificationChannelEnum } from 'src/notifications/notification.constants';
import { NotificationsService } from 'src/notifications/notifications.service';
import {
  SubscriptionPlanEntity,
  BillingCycleEnum,
  PlanVisibilityEnum,
} from './entities/subscription-plan.entity';
import { AccountSubscriptionEntity, SubscriptionStatusEnum } from './entities/account-subscription.entity';
import { FeatureOverrideEntity } from './entities/feature-override.entity';
import { FeatureRequestEntity, FeatureRequestStatusEnum } from './entities/feature-request.entity';
import { EntitlementsService } from './entitlements.service';
import { TenantContext } from 'src/common/tenancy/tenant-context';
import { OrganizationEntity } from 'src/organizations/entities/organization.entity';
import { OrganizationMemberEntity } from 'src/organizations/entities/organization-member.entity';
import { OrganizationKindEnum } from 'src/organizations/enums/organization-kind.enum';
import { OrganizationMemberRoleEnum } from 'src/organizations/enums/organization-member-role.enum';
import { SoloOrganizationService } from 'src/organizations/solo-organization.service';
import {
  PaymentHistoryEntity,
  PaymentStatusEnum,
} from './entities/payment-history.entity';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';
import { UserEntity } from 'src/user/entities/user.entity';
import { RolesEnum } from 'src/common/enums/roles.enum';
import {
  ALL_FEATURE_KEYS,
  FEATURE_CATALOG,
  ALL_LIMIT_KEYS,
  SEED_PLAN_PRESETS,
  validateFeaturesInput,
  validateLimitsInput,
  mergeFeatures,
  mergeLimits,
  PlanLimits,
} from './constants/feature-catalog';
import {
  AssignPlanDto,
  ChangePlanDto,
  CreatePlanDto,
  GrantTempAccessDto,
  ReorderPlansDto,
  CreateFeatureRequestDto,
  SetFeatureOverrideDto,
  SubscribeByPlanIdDto,
  SubscriptionOverridesDto,
  UpdatePlanDto,
} from './dto/plan-management.dto';
import { PaymentMethodEnum } from './entities/payment-history.entity';
import { ActiveStatusEnum } from 'src/common/enums/active-status.enum';

@Injectable()
export class SubscriptionService implements OnModuleInit {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    @InjectRepository(SubscriptionPlanEntity)
    private readonly planRepo: Repository<SubscriptionPlanEntity>,

    @InjectRepository(AccountSubscriptionEntity)
    private readonly subscriptionRepo: Repository<AccountSubscriptionEntity>,

    @InjectRepository(PaymentHistoryEntity)
    private readonly paymentRepo: Repository<PaymentHistoryEntity>,

    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,

    @InjectRepository(FeatureOverrideEntity)
    private readonly overrideRepo: Repository<FeatureOverrideEntity>,

    @InjectRepository(FeatureRequestEntity)
    private readonly featureRequestRepo: Repository<FeatureRequestEntity>,

    @InjectRepository(OrganizationEntity)
    private readonly organizationRepo: Repository<OrganizationEntity>,

    @InjectRepository(OrganizationMemberEntity)
    private readonly memberRepo: Repository<OrganizationMemberEntity>,

    private readonly entitlementsService: EntitlementsService,
    private readonly soloOrganizations: SoloOrganizationService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    // Seeding runs in the API process only; the worker boots at the same time (worker.ts).
    if (process.env.APP_ROLE === 'worker') return;
    await this.seedPlans();
  }

  /**
   * Creates the preset plans (free, basic, premium, pro) that do not exist yet. Existing plans are
   * never changed: Admin → Plans owns their prices, features, limits and visibility.
   */
  private async seedPlans(): Promise<void> {
    const created: string[] = [];
    for (const preset of Object.values(SEED_PLAN_PRESETS)) {
      const existing = await this.planRepo.findOne({ where: { slug: preset.slug } });
      if (existing) {
        await this.addMissingPresetLimits(existing, preset.limits);
        continue;
      }

      await this.planRepo.save(
        this.planRepo.create({
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
        }),
      );
      created.push(preset.slug);
    }
    if (created.length) this.logger.log(`Subscription plans created: ${created.join(', ')}`);
  }

  /**
   * A limit added to the catalogue after a preset plan was created (e.g. `sms_credits_per_month`,
   * P2-08) gets the preset's value, only while the plan has no value for it. A value an admin saved
   * in Admin → Plans is never changed.
   */
  private async addMissingPresetLimits(plan: SubscriptionPlanEntity, presetLimits: PlanLimits): Promise<void> {
    const limits = { ...(plan.limits ?? {}) } as Record<string, number>;
    const added = Object.entries(presetLimits).filter(([key]) => !(key in limits));
    if (added.length === 0) return;
    for (const [key, value] of added) limits[key] = Number(value);
    await this.planRepo.update(plan.id, { limits: limits as PlanLimits });
    await this.entitlementsService.invalidate();
    this.logger.log(`Plan ${plan.slug}: added limits ${added.map(([key]) => key).join(', ')}`);
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

    const saved = await this.planRepo.save(plan);
    this.audit.record({
      action: AUDIT_ACTIONS.PLAN_CREATE,
      actorId: jwtPayload.id,
      entityType: 'subscription_plan',
      entityId: saved.id,
      after: planState(saved),
    });
    return saved;
  }

  async updatePlan(
    planId: string,
    dto: UpdatePlanDto,
    jwtPayload: JwtPayloadInterface,
  ): Promise<SubscriptionPlanEntity> {
    const plan = await this.getPlanById(planId);
    const before = planState(plan);

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

    const saved = await this.planRepo.save(plan);
    this.audit.record({
      action: AUDIT_ACTIONS.PLAN_UPDATE,
      actorId: jwtPayload.id,
      entityType: 'subscription_plan',
      entityId: saved.id,
      ...auditChanges(before, planState(saved)),
    });
    // Every organisation on this plan sees the change at its next page load (FND-07).
    await this.entitlementsService.invalidate();
    return saved;
  }

  async deletePlan(planId: string, jwtPayload: JwtPayloadInterface): Promise<void> {
    const plan = await this.getPlanById(planId);
    // Every organisation without a subscription is on Free (EntitlementsService.getFreePlan).
    if (plan.slug === 'free') {
      throw new BadRequestException('The Free plan cannot be deleted; edit it or change its limits instead');
    }
    const activeSubs = await this.subscriptionRepo.count({
      where: { plan_id: plan.id, status: SubscriptionStatusEnum.ACTIVE },
    });
    if (activeSubs > 0) {
      throw new BadRequestException('Cannot delete plan with active subscriptions');
    }
    const before = planState(plan);
    await this.planRepo.remove(plan);
    this.audit.record({
      action: AUDIT_ACTIONS.PLAN_DELETE,
      actorId: jwtPayload.id,
      entityType: 'subscription_plan',
      entityId: planId,
      before,
    });
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

  async reorderPlans(dto: ReorderPlansDto, jwtPayload: JwtPayloadInterface): Promise<SubscriptionPlanEntity[]> {
    for (let i = 0; i < dto.plan_ids.length; i++) {
      await this.planRepo.update({ id: dto.plan_ids[i] }, { sort_order: i + 1 });
    }
    this.audit.record({ action: AUDIT_ACTIONS.PLAN_REORDER, actorId: jwtPayload.id, after: { plan_ids: dto.plan_ids } });
    return this.getAllPlansAdmin();
  }

  async setPlanActive(planId: string, active: boolean, jwtPayload: JwtPayloadInterface): Promise<SubscriptionPlanEntity> {
    const plan = await this.getPlanById(planId);
    const wasActive = plan.is_plan_active;
    plan.is_plan_active = active;
    const saved = await this.planRepo.save(plan);
    this.audit.record({
      action: active ? AUDIT_ACTIONS.PLAN_ACTIVATE : AUDIT_ACTIONS.PLAN_DEACTIVATE,
      actorId: jwtPayload.id,
      entityType: 'subscription_plan',
      entityId: saved.id,
      before: { is_plan_active: wasActive },
      after: { is_plan_active: active },
    });
    await this.entitlementsService.invalidate();
    return saved;
  }

  // ===========================================================================
  // Account subscriptions (P2-02): a plan belongs to an organisation (a solo teacher's SOLO one
  // or a school). No ACTIVE subscription means the Free plan.
  // ===========================================================================

  async getAccountSubscription(organizationId: string): Promise<AccountSubscriptionEntity | null> {
    return this.entitlementsService.findActiveSubscription(organizationId);
  }

  /** A solo teacher manages their own plan; in a school the owner and admins do. */
  async assertCanManageBilling(organizationId: string, userId: string): Promise<void> {
    const membership = await this.memberRepo.findOne({
      where: { organization_id: organizationId, user_id: userId },
      relations: ['organization'],
    });
    const allowed =
      membership &&
      membership.is_active !== ActiveStatusEnum.INACTIVE &&
      (membership.role === OrganizationMemberRoleEnum.OWNER ||
        (membership.role === OrganizationMemberRoleEnum.ADMIN && membership.organization?.kind !== OrganizationKindEnum.SOLO));
    if (!allowed) {
      throw new ForbiddenException("Only the owner or an admin can change this workspace's plan");
    }
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

  private async cancelActiveSubscription(organizationId: string): Promise<AccountSubscriptionEntity | null> {
    const existing = await this.getAccountSubscription(organizationId);
    if (existing) {
      existing.status = SubscriptionStatusEnum.CANCELLED;
      await this.subscriptionRepo.save(existing);
    }
    return existing;
  }

  private async cancelPendingSubscriptions(organizationId: string): Promise<void> {
    await this.subscriptionRepo.update(
      { organization_id: organizationId, status: SubscriptionStatusEnum.PENDING },
      { status: SubscriptionStatusEnum.CANCELLED },
    );
  }

  /** The first OWNER of an organisation (who the legacy payment_history rows are filed under). */
  private async ownerOf(organizationId: string): Promise<string | null> {
    const owner = await this.memberRepo.findOne({
      where: { organization_id: organizationId, role: OrganizationMemberRoleEnum.OWNER },
      order: { created_at: 'ASC' },
    });
    return owner?.user_id ?? null;
  }

  /**
   * Subscribe the current workspace (the request's tenant) to a plan. A free plan starts at
   * once; a paid one stays PENDING, and the current plan keeps working, until payment succeeds.
   * The price is computed here from the plan, never taken from the browser.
   */
  async subscribe(dto: SubscribeByPlanIdDto, jwtPayload: JwtPayloadInterface): Promise<AccountSubscriptionEntity> {
    const organizationId = TenantContext.requireOrganizationId();
    await this.assertCanManageBilling(organizationId, jwtPayload.id);

    const plan = await this.getPlanById(dto.plan_id);
    if (!plan.is_plan_active) {
      throw new BadRequestException('This plan is currently not available');
    }

    const { amount, endDate, startDate } = this.calculateBilling(plan, dto.billing_cycle);
    const isFree = amount === 0;

    if (isFree) {
      await this.cancelActiveSubscription(organizationId);
    } else {
      await this.cancelPendingSubscriptions(organizationId);
    }

    const saved = await this.subscriptionRepo.save(
      this.subscriptionRepo.create({
        organization_id: organizationId,
        teacher_id: jwtPayload.id,
        plan_id: plan.id,
        billing_cycle: dto.billing_cycle,
        price_due: amount,
        amount_paid: 0,
        status: isFree ? SubscriptionStatusEnum.ACTIVE : SubscriptionStatusEnum.PENDING,
        start_date: startDate,
        end_date: isFree ? undefined : endDate,
        created_by: jwtPayload.id,
        created_user_name: jwtPayload.full_name,
        created_at: new Date(),
      }),
    );

    // A manual payment reference (bKash etc.) is recorded for an admin to confirm.
    if (!isFree) {
      await this.paymentRepo.save(
        this.paymentRepo.create({
          organization_id: organizationId,
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

    if (isFree) await this.entitlementsService.invalidate(organizationId);

    const result = await this.subscriptionRepo.findOne({ where: { id: saved.id }, relations: ['plan'] });
    if (!result) throw new BadRequestException('Failed to create subscription');
    return result;
  }

  /** The organisation a platform admin means: given directly, or a teacher's SOLO organisation. */
  async resolveAdminTarget(target: { organization_id?: string; teacher_id?: string }): Promise<string> {
    if (target.organization_id) {
      const organization = await this.organizationRepo.findOne({ where: { id: target.organization_id } });
      if (!organization) throw new NotFoundException('Organization not found');
      return organization.id;
    }
    if (target.teacher_id) {
      const teacher = await this.userRepo.findOne({ where: { id: target.teacher_id } });
      if (!teacher || teacher.role !== RolesEnum.TEACHER) throw new BadRequestException('Teacher not found');
      return this.soloOrganizations.ensureForTeacher(teacher);
    }
    throw new BadRequestException('organization_id or teacher_id is required');
  }

  /** Platform admin: put an organisation on a plan now (no payment flow). */
  async assignPlan(dto: AssignPlanDto, jwtPayload: JwtPayloadInterface): Promise<AccountSubscriptionEntity> {
    const organizationId = await this.resolveAdminTarget(dto);
    const plan = await this.getPlanById(dto.plan_id);
    const previous = await this.cancelActiveSubscription(organizationId);

    let amount = 0;
    let endDate: Date | undefined;
    if (dto.billing_cycle) {
      const billing = this.calculateBilling(plan, dto.billing_cycle);
      amount = billing.amount;
      endDate = billing.endDate;
    }

    const saved = await this.subscriptionRepo.save(
      this.subscriptionRepo.create({
        organization_id: organizationId,
        teacher_id: dto.teacher_id ?? null,
        plan_id: plan.id,
        billing_cycle: dto.billing_cycle,
        price_due: amount,
        amount_paid: amount,
        status: SubscriptionStatusEnum.ACTIVE,
        start_date: new Date(),
        end_date: endDate,
        created_by: jwtPayload.id,
        created_user_name: jwtPayload.full_name,
        created_at: new Date(),
      }),
    );

    if (amount > 0) {
      await this.paymentRepo.save(
        this.paymentRepo.create({
          organization_id: organizationId,
          teacher_id: dto.teacher_id ?? (await this.ownerOf(organizationId)) ?? jwtPayload.id,
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

    this.audit.record({
      action: AUDIT_ACTIONS.SUBSCRIPTION_PLAN_ASSIGN,
      organizationId,
      actorId: jwtPayload.id,
      entityType: 'account_subscription',
      entityId: saved.id,
      before: previous ? subscriptionState(previous) : null,
      after: { ...subscriptionState(saved), plan_slug: plan.slug, plan_name: plan.name },
      reason: dto.notes,
    });
    await this.entitlementsService.invalidate(organizationId);
    const result = await this.subscriptionRepo.findOne({ where: { id: saved.id }, relations: ['plan', 'organization'] });
    if (!result) throw new BadRequestException('Failed to assign subscription');
    return result;
  }

  async upgradePlan(dto: ChangePlanDto, jwtPayload: JwtPayloadInterface): Promise<AccountSubscriptionEntity> {
    return this.subscribe({ plan_id: dto.plan_id, billing_cycle: dto.billing_cycle, payment_method: dto.payment_method }, jwtPayload);
  }

  async downgradePlan(dto: ChangePlanDto, jwtPayload: JwtPayloadInterface): Promise<AccountSubscriptionEntity> {
    return this.subscribe({ plan_id: dto.plan_id, billing_cycle: dto.billing_cycle, payment_method: dto.payment_method }, jwtPayload);
  }

  /** Platform admin, legacy route keyed by teacher: changes their SOLO organisation's plan. */
  async forceChangePlan(teacherId: string, dto: ChangePlanDto, jwtPayload: JwtPayloadInterface): Promise<AccountSubscriptionEntity> {
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

  /** Cancel the current workspace's plan; it falls back to Free. */
  async cancelSubscription(organizationId: string, userId: string): Promise<AccountSubscriptionEntity | null> {
    await this.assertCanManageBilling(organizationId, userId);
    const cancelled = await this.cancelActiveSubscription(organizationId);
    if (cancelled) {
      this.audit.record({
        action: AUDIT_ACTIONS.SUBSCRIPTION_CANCEL,
        organizationId,
        actorId: userId,
        entityType: 'account_subscription',
        entityId: cancelled.id,
        before: { status: SubscriptionStatusEnum.ACTIVE, plan_id: cancelled.plan_id },
        after: { status: cancelled.status },
      });
    }
    await this.entitlementsService.invalidate(organizationId);
    return cancelled;
  }

  // ---------------------------------------------------------------------------
  // Feature overrides (FND-07): a platform admin's per-organisation switches.
  // ---------------------------------------------------------------------------

  async setOverride(
    organizationId: string,
    key: string,
    dto: SetFeatureOverrideDto,
    jwtPayload: JwtPayloadInterface,
  ): Promise<FeatureOverrideEntity> {
    const isFeature = (ALL_FEATURE_KEYS as string[]).includes(key);
    const isLimit = (ALL_LIMIT_KEYS as string[]).includes(key);
    if (!isFeature && !isLimit) throw new BadRequestException(`Unknown feature or limit "${key}"`);
    if (isFeature && typeof dto.value !== 'boolean') throw new BadRequestException(`"${key}" needs true or false`);
    if (isLimit && (typeof dto.value !== 'number' || dto.value < 0)) {
      throw new BadRequestException(`"${key}" needs a number of 0 or more (0 = no limit)`);
    }
    const expiresAt = dto.expires_at ? new Date(dto.expires_at) : null;
    if (expiresAt && Number.isNaN(expiresAt.getTime())) throw new BadRequestException('expires_at must be a date');
    await this.resolveAdminTarget({ organization_id: organizationId });

    const existing = await this.overrideRepo.findOne({ where: { organization_id: organizationId, key } });
    const saved = await this.overrideRepo.save(
      this.overrideRepo.create({
        ...(existing ?? {}),
        organization_id: organizationId,
        key,
        value: dto.value,
        expires_at: expiresAt,
        reason: dto.reason ?? null,
        granted_by: jwtPayload.id,
        ...(existing
          ? { updated_by: jwtPayload.id, updated_user_name: jwtPayload.full_name, updated_at: new Date() }
          : { created_by: jwtPayload.id, created_user_name: jwtPayload.full_name, created_at: new Date() }),
      }),
    );
    this.audit.record({
      action: AUDIT_ACTIONS.SUBSCRIPTION_OVERRIDE_SET,
      organizationId,
      actorId: jwtPayload.id,
      entityType: 'feature_override',
      entityId: saved.id,
      before: existing ? overrideState(existing) : null,
      after: overrideState(saved),
      reason: dto.reason,
    });
    await this.entitlementsService.invalidate(organizationId);
    return saved;
  }

  async removeOverride(organizationId: string, key: string, jwtPayload: JwtPayloadInterface): Promise<void> {
    const existing = await this.overrideRepo.findOne({ where: { organization_id: organizationId, key } });
    await this.overrideRepo.delete({ organization_id: organizationId, key });
    if (existing) {
      this.audit.record({
        action: AUDIT_ACTIONS.SUBSCRIPTION_OVERRIDE_REMOVE,
        organizationId,
        actorId: jwtPayload.id,
        entityType: 'feature_override',
        entityId: existing.id,
        before: overrideState(existing),
      });
    }
    await this.entitlementsService.invalidate(organizationId);
  }

  /** Legacy bulk form ({ features, limits, expires_at }), stored as one override per key. */
  async setSubscriptionOverrides(
    target: { organization_id?: string; teacher_id?: string },
    dto: SubscriptionOverridesDto,
    jwtPayload: JwtPayloadInterface,
  ): Promise<FeatureOverrideEntity[]> {
    const organizationId = await this.resolveAdminTarget(target);
    const entries: Array<[string, boolean | number]> = [
      ...Object.entries(dto.features ? validateFeaturesInput(dto.features) : {}),
      ...Object.entries(dto.limits ? validateLimitsInput(dto.limits) : {}),
    ];
    const saved: FeatureOverrideEntity[] = [];
    for (const [key, value] of entries) {
      saved.push(await this.setOverride(organizationId, key, { value, expires_at: dto.expires_at }, jwtPayload));
    }
    return saved;
  }

  async grantTempAccess(dto: GrantTempAccessDto, jwtPayload: JwtPayloadInterface): Promise<FeatureOverrideEntity[]> {
    const organizationId = await this.resolveAdminTarget(dto);
    if (dto.plan_id) {
      await this.assignPlan(
        { organization_id: organizationId, plan_id: dto.plan_id, billing_cycle: BillingCycleEnum.MONTHLY, notes: 'Temporary access grant' },
        jwtPayload,
      );
    }
    return this.setSubscriptionOverrides(
      { organization_id: organizationId },
      { features: dto.features, limits: dto.limits, expires_at: dto.expires_at },
      jwtPayload,
    );
  }

  /** Platform admin: an organisation's plan, overrides and effective entitlements. */
  async getAdminOrganizationEntitlements(organizationId: string) {
    const organization = await this.organizationRepo.findOne({ where: { id: organizationId } });
    if (!organization) throw new NotFoundException('Organization not found');
    const [entitlements, overrides] = await Promise.all([
      this.entitlementsService.getEntitlements(organizationId),
      this.overrideRepo.find({ where: { organization_id: organizationId }, order: { key: 'ASC' } }),
    ]);
    return {
      organization: { id: organization.id, name: organization.name, kind: organization.kind, status: organization.status },
      entitlements,
      overrides,
    };
  }

  // ---------------------------------------------------------------------------
  // Payments
  // ---------------------------------------------------------------------------

  private async swapToActiveSubscription(
    subscription: AccountSubscriptionEntity,
    amount: number,
  ): Promise<AccountSubscriptionEntity> {
    const previousActive = await this.getAccountSubscription(subscription.organization_id);
    if (previousActive && previousActive.id !== subscription.id) {
      previousActive.status = SubscriptionStatusEnum.CANCELLED;
      await this.subscriptionRepo.save(previousActive);
    }

    subscription.status = SubscriptionStatusEnum.ACTIVE;
    subscription.amount_paid = amount;
    const saved = await this.subscriptionRepo.save(subscription);
    await this.entitlementsService.invalidate(subscription.organization_id);
    return saved;
  }

  /**
   * A PENDING paid subscription of `organizationId`, for checkout by someone who may manage its
   * billing. Another organisation's subscription is "not found", so ids are not leaked. The price
   * is `price_due`, computed by `subscribe()` from the plan on the server.
   */
  async getPendingSubscriptionForPayment(
    subscriptionId: string,
    organizationId: string,
    userId: string,
  ): Promise<AccountSubscriptionEntity> {
    const subscription = await this.subscriptionRepo.findOne({
      where: { id: subscriptionId, organization_id: organizationId },
      relations: ['plan'],
    });

    if (!subscription) throw new NotFoundException('Subscription not found');
    await this.assertCanManageBilling(organizationId, userId);
    if (subscription.status !== SubscriptionStatusEnum.PENDING) {
      throw new BadRequestException('Subscription is not awaiting payment');
    }
    if (!(Number(subscription.price_due) > 0)) {
      throw new BadRequestException('Subscription has no payable amount');
    }

    return subscription;
  }

  async activateSubscriptionFromPayment(
    subscriptionId: string,
    transactionId: string,
    amount: number,
    gatewayReference?: string,
  ): Promise<AccountSubscriptionEntity> {
    const subscription = await this.subscriptionRepo.findOne({ where: { id: subscriptionId }, relations: ['plan'] });
    if (!subscription) throw new NotFoundException('Subscription not found');

    // Defence in depth: never activate for less than the server-side price.
    const price = Number(subscription.price_due);
    if (!(Number(amount) + 0.01 >= price)) {
      throw new BadRequestException('Paid amount is below the subscription price');
    }

    const activated = await this.swapToActiveSubscription(subscription, amount);

    await this.paymentRepo.save(
      this.paymentRepo.create({
        organization_id: subscription.organization_id,
        teacher_id: subscription.teacher_id ?? (await this.ownerOf(subscription.organization_id)) ?? undefined,
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

    return activated;
  }

  async confirmPayment(paymentId: string, transactionId: string, jwtPayload: JwtPayloadInterface): Promise<PaymentHistoryEntity> {
    const payment = await this.paymentRepo.findOne({ where: { id: paymentId }, relations: ['subscription'] });

    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status === PaymentStatusEnum.COMPLETED) {
      throw new BadRequestException('Payment already confirmed');
    }
    const previousStatus = payment.status;

    payment.status = PaymentStatusEnum.COMPLETED;
    payment.transaction_id = transactionId;
    payment.payment_date = new Date();
    payment.updated_by = jwtPayload.id;
    payment.updated_user_name = jwtPayload.full_name;
    payment.updated_at = new Date();
    await this.paymentRepo.save(payment);

    if (payment.subscription) {
      await this.swapToActiveSubscription(payment.subscription, Number(payment.amount));
    }
    this.audit.record({
      action: AUDIT_ACTIONS.PAYMENT_CONFIRM,
      organizationId: payment.organization_id,
      actorId: jwtPayload.id,
      entityType: 'payment',
      entityId: payment.id,
      before: { status: previousStatus },
      after: { status: payment.status, amount: Number(payment.amount), transaction_id: transactionId, subscription_id: payment.subscription_id },
    });
    return payment;
  }

  async getPaymentHistory(organizationId: string): Promise<PaymentHistoryEntity[]> {
    return this.paymentRepo.find({
      where: { organization_id: organizationId },
      relations: ['subscription'],
      order: { created_at: 'DESC' },
    });
  }

  async getAllSubscriptions(): Promise<AccountSubscriptionEntity[]> {
    return this.subscriptionRepo.find({
      relations: ['teacher', 'plan', 'organization'],
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
      relations: ['teacher', 'subscription', 'plan'],
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { items, total, page, limit };
  }

  async setTeacherActive(teacherId: string, active: boolean, jwtPayload: JwtPayloadInterface): Promise<UserEntity> {
    const teacher = await this.userRepo.findOne({ where: { id: teacherId } });
    if (!teacher || teacher.role !== RolesEnum.TEACHER) {
      throw new NotFoundException('Teacher not found');
    }

    const wasActive = teacher.is_active === ActiveStatusEnum.ACTIVE;
    teacher.is_active = active ? ActiveStatusEnum.ACTIVE : ActiveStatusEnum.INACTIVE;
    teacher.updated_at = new Date();
    const saved = await this.userRepo.save(teacher);
    this.audit.record({
      action: AUDIT_ACTIONS.TEACHER_STATUS_CHANGE,
      organizationId: await this.soloOrganizations.findIdForOwner(teacherId),
      actorId: jwtPayload.id,
      entityType: 'user',
      entityId: teacherId,
      before: { active: wasActive },
      after: { active },
    });
    return saved;
  }

  // ---------------------------------------------------------------------------
  // Feature requests (FND-08)
  // ---------------------------------------------------------------------------

  /** "Request this feature" for the current workspace; an open request for the same feature is reused. */
  async createFeatureRequest(dto: CreateFeatureRequestDto, jwtPayload: JwtPayloadInterface): Promise<FeatureRequestEntity> {
    const organizationId = TenantContext.requireOrganizationId();
    if (!(ALL_FEATURE_KEYS as string[]).includes(dto.feature_key)) {
      throw new BadRequestException(`Unknown feature "${dto.feature_key}"`);
    }
    const open = await this.featureRequestRepo.findOne({
      where: { organization_id: organizationId, feature_key: dto.feature_key, status: FeatureRequestStatusEnum.OPEN },
    });
    if (open) return open;

    // The request and the email to platform admins (FND-08) commit together.
    return this.featureRequestRepo.manager.transaction(async (manager) => {
      const saved = await manager.save(
        this.featureRequestRepo.create({
          organization_id: organizationId,
          user_id: jwtPayload.id,
          feature_key: dto.feature_key,
          note: dto.note?.trim() || null,
          status: FeatureRequestStatusEnum.OPEN,
          created_by: jwtPayload.id,
          created_user_name: jwtPayload.full_name,
          created_at: new Date(),
        }),
      );
      await this.notifyPlatformAdminsOfRequest(saved, jwtPayload, manager);
      return saved;
    });
  }

  /** Emails every active platform admin about a new feature request, in their language. */
  private async notifyPlatformAdminsOfRequest(
    request: FeatureRequestEntity,
    jwtPayload: JwtPayloadInterface,
    manager: EntityManager,
  ): Promise<void> {
    const [admins, organization] = await Promise.all([
      manager.find(UserEntity, {
        where: { role: In([RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN]), is_active: ActiveStatusEnum.ACTIVE },
        select: ['id', 'email'],
      }),
      manager.findOne(OrganizationEntity, { where: { id: request.organization_id }, select: ['id', 'name'] }),
    ]);
    const feature = FEATURE_CATALOG.find((f) => f.key === request.feature_key)?.label ?? request.feature_key;
    await this.notifications.enqueue(
      admins
        .filter((admin) => admin.email)
        .map((admin) => ({
          eventType: NOTIFICATION_EVENTS.FEATURE_REQUEST_CREATED,
          channel: NotificationChannelEnum.EMAIL,
          // A platform notice: not in the organisation's message log.
          organizationId: null,
          userId: admin.id,
          variables: {
            organization_name: organization?.name ?? '',
            user_name: jwtPayload.full_name ?? '',
            feature,
            note: request.note ?? '',
            link: `${resolveFrontendUrl(this.configService)}/admin/feature-requests`,
          },
          dedupeKey: `feature_request.created:${request.id}:${admin.id}`,
          createdBy: jwtPayload.id,
        })),
      manager,
    );
  }

  /** The newest 200 requests, with only the organisation and user fields the admin list shows. */
  async listFeatureRequests(status?: FeatureRequestStatusEnum) {
    const requests = await this.featureRequestRepo.find({
      where: status ? { status } : {},
      relations: ['organization', 'user'],
      order: { created_at: 'DESC' },
      take: 200,
    });
    // Never the whole user row: it holds the password hash (no serializer strips @Exclude fields).
    return requests.map(({ organization, user, ...request }) => ({
      ...request,
      organization: organization ? { id: organization.id, name: organization.name, kind: organization.kind } : null,
      user: user ? { id: user.id, full_name: user.full_name, email: user.email, phone: user.phone } : null,
    }));
  }

  async markFeatureRequestHandled(id: string, jwtPayload: JwtPayloadInterface): Promise<FeatureRequestEntity> {
    const request = await this.featureRequestRepo.findOne({ where: { id } });
    if (!request) throw new NotFoundException('Request not found');
    request.status = FeatureRequestStatusEnum.HANDLED;
    request.handled_at = new Date();
    request.updated_by = jwtPayload.id;
    request.updated_user_name = jwtPayload.full_name;
    request.updated_at = new Date();
    const saved = await this.featureRequestRepo.save(request);
    this.audit.record({
      action: AUDIT_ACTIONS.FEATURE_REQUEST_HANDLED,
      organizationId: saved.organization_id,
      actorId: jwtPayload.id,
      entityType: 'feature_request',
      entityId: saved.id,
      after: { feature_key: saved.feature_key, status: saved.status },
    });
    return saved;
  }
}

/** The plan fields the audit log keeps (design §8.10). */
const planState = (plan: SubscriptionPlanEntity) => ({
  name: plan.name,
  slug: plan.slug,
  price_monthly: Number(plan.price_monthly),
  price_half_yearly: Number(plan.price_half_yearly),
  price_yearly: Number(plan.price_yearly),
  visibility: plan.visibility,
  is_custom: plan.is_custom,
  sort_order: plan.sort_order,
  is_plan_active: plan.is_plan_active,
  features: plan.features,
  limits: plan.limits,
});

const subscriptionState = (subscription: AccountSubscriptionEntity) => ({
  plan_id: subscription.plan_id,
  status: subscription.status,
  billing_cycle: subscription.billing_cycle ?? null,
  end_date: subscription.end_date ?? null,
});

const overrideState = (override: FeatureOverrideEntity) => ({
  key: override.key,
  value: override.value,
  expires_at: override.expires_at,
});
