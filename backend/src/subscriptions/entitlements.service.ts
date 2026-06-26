import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import {
  FeatureKey,
  LimitKey,
  mergeFeatures,
  mergeLimits,
  PlanFeatures,
  PlanLimits,
} from './constants/feature-catalog';
import { SubscriptionPlanEntity } from './entities/subscription-plan.entity';
import {
  SubscriptionStatusEnum,
  TeacherSubscriptionEntity,
} from './entities/teacher-subscription.entity';
import { ExamEntity } from 'src/exams/entities/exam.entity';

export interface EntitlementsUsage {
  exams_used_this_month: number;
  total_exams_used: number;
}

export interface EntitlementsPayload {
  plan: {
    id: string;
    name: string;
    slug: string;
  };
  features: PlanFeatures;
  limits: PlanLimits;
  usage: EntitlementsUsage;
  subscription: {
    id: string;
    status: SubscriptionStatusEnum;
    billing_cycle?: string;
    start_date: Date;
    end_date?: Date;
    overrides?: TeacherSubscriptionEntity['overrides'];
  } | null;
}

@Injectable()
export class EntitlementsService {
  constructor(
    @InjectRepository(SubscriptionPlanEntity)
    private readonly planRepo: Repository<SubscriptionPlanEntity>,

    @InjectRepository(TeacherSubscriptionEntity)
    private readonly subscriptionRepo: Repository<TeacherSubscriptionEntity>,

    @InjectRepository(ExamEntity)
    private readonly examRepo: Repository<ExamEntity>,
  ) {}

  /**
   * Usage is derived from the actual exams a teacher has created, so the numbers
   * always reflect reality (including exams created before counting existed).
   */
  async getUsageCounts(teacherId: string): Promise<EntitlementsUsage> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [totalUsed, monthlyUsed] = await Promise.all([
      this.examRepo.count({ where: { created_by: teacherId } }),
      this.examRepo.count({
        where: { created_by: teacherId, created_at: MoreThanOrEqual(startOfMonth) },
      }),
    ]);

    return {
      exams_used_this_month: monthlyUsed,
      total_exams_used: totalUsed,
    };
  }

  private async findActiveSubscription(teacherId: string): Promise<TeacherSubscriptionEntity | null> {
    const subscription = await this.subscriptionRepo.findOne({
      where: {
        teacher_id: teacherId,
        status: SubscriptionStatusEnum.ACTIVE,
      },
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

  async getEffectivePlan(teacherId: string): Promise<SubscriptionPlanEntity> {
    const subscription = await this.findActiveSubscription(teacherId);
    if (subscription?.plan) {
      return subscription.plan;
    }

    const freePlan = await this.planRepo.findOne({ where: { slug: 'free' } });
    if (!freePlan) {
      throw new NotFoundException('Default free plan not found');
    }
    return freePlan;
  }

  private getActiveOverrides(subscription: TeacherSubscriptionEntity | null): {
    features?: PlanFeatures;
    limits?: PlanLimits;
  } | null {
    if (!subscription?.overrides) return null;

    const expiresAt = subscription.overrides.expires_at;
    if (expiresAt && new Date(expiresAt) < new Date()) {
      return null;
    }

    return {
      features: subscription.overrides.features,
      limits: subscription.overrides.limits,
    };
  }

  async getEntitlements(teacherId: string): Promise<EntitlementsPayload> {
    const subscription = await this.findActiveSubscription(teacherId);
    const plan = subscription?.plan ?? (await this.getEffectivePlan(teacherId));
    const activeOverrides = this.getActiveOverrides(subscription);

    const features = mergeFeatures(plan.features ?? {}, activeOverrides?.features);
    const limits = mergeLimits(plan.limits ?? {}, activeOverrides?.limits);
    const usage = await this.getUsageCounts(teacherId);

    return {
      plan: {
        id: plan.id,
        name: plan.name,
        slug: plan.slug,
      },
      features,
      limits,
      usage,
      subscription: subscription
        ? {
            id: subscription.id,
            status: subscription.status,
            billing_cycle: subscription.billing_cycle,
            start_date: subscription.start_date,
            end_date: subscription.end_date,
            overrides: subscription.overrides,
          }
        : null,
    };
  }

  async hasFeature(teacherId: string, key: FeatureKey | string): Promise<boolean> {
    const entitlements = await this.getEntitlements(teacherId);
    return Boolean(entitlements.features[key as FeatureKey]);
  }

  async checkLimit(
    teacherId: string,
    key: LimitKey | string,
    currentValue: number,
  ): Promise<{ allowed: boolean; limit: number; current: number }> {
    const entitlements = await this.getEntitlements(teacherId);
    const limit = entitlements.limits[key as LimitKey] ?? 0;

    if (limit === 0) {
      return { allowed: true, limit: 0, current: currentValue };
    }

    return {
      allowed: currentValue < limit,
      limit,
      current: currentValue,
    };
  }

  async assertFeature(teacherId: string, key: FeatureKey | string, message?: string): Promise<void> {
    const allowed = await this.hasFeature(teacherId, key);
    if (!allowed) {
      throw new ForbiddenException(message ?? `Feature "${key}" is not available on your plan. Please upgrade.`);
    }
  }

  async assertLimit(
    teacherId: string,
    key: LimitKey | string,
    currentValue: number,
    message?: string,
  ): Promise<void> {
    const result = await this.checkLimit(teacherId, key, currentValue);
    if (!result.allowed) {
      throw new ForbiddenException(
        message ??
          `You have reached your plan limit for "${key}" (${result.limit}). Please upgrade your plan.`,
      );
    }
  }

  async canCreateExam(teacherId: string): Promise<{ allowed: boolean; reason?: string }> {
    const entitlements = await this.getEntitlements(teacherId);
    const usage = entitlements.usage;

    const totalLimit = entitlements.limits[LimitKey.MAX_TOTAL_EXAMS] ?? 0;
    if (totalLimit > 0 && usage.total_exams_used >= totalLimit) {
      return {
        allowed: false,
        reason: `You have reached your total exam limit (${totalLimit}). Please upgrade your plan.`,
      };
    }

    const monthlyLimit = entitlements.limits[LimitKey.MAX_EXAMS_PER_MONTH] ?? 0;
    if (monthlyLimit > 0 && usage.exams_used_this_month >= monthlyLimit) {
      return {
        allowed: false,
        reason: `You have reached your monthly exam limit (${monthlyLimit}). Please wait until next month or upgrade your plan.`,
      };
    }

    return { allowed: true };
  }
}
