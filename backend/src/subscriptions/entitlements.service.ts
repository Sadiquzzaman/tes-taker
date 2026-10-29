import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { RedisService } from 'src/config/redis.service';
import { ExamEntity } from 'src/exams/entities/exam.entity';
import {
  ALL_FEATURE_KEYS,
  ALL_LIMIT_KEYS,
  FeatureKey,
  LimitKey,
  mergeFeatures,
  mergeLimits,
  PlanFeatures,
  PlanLimits,
} from './constants/feature-catalog';
import { AccountSubscriptionEntity, SubscriptionStatusEnum } from './entities/account-subscription.entity';
import { FeatureOverrideEntity } from './entities/feature-override.entity';
import { SubscriptionPlanEntity } from './entities/subscription-plan.entity';

/** The error code clients use to show the role-based upgrade message (FND-07, design §8.3). */
export const FEATURE_NOT_IN_PLAN = 'FEATURE_NOT_IN_PLAN';
/** Same idea for limits (tests this month, students per test, …). */
export const PLAN_LIMIT_REACHED = 'PLAN_LIMIT_REACHED';

/** 403 the client turns into "one upgrade away" (owners, admins) or "ask your admin" (everyone else). */
export class FeatureNotInPlanException extends ForbiddenException {
  constructor(feature: string, message?: string) {
    super({
      statusCode: 403,
      code: FEATURE_NOT_IN_PLAN,
      feature,
      message: message ?? `Feature "${feature}" is not available on your plan. Please upgrade.`,
    });
  }
}

export class PlanLimitReachedException extends ForbiddenException {
  constructor(limit: string, message: string) {
    super({ statusCode: 403, code: PLAN_LIMIT_REACHED, limit, message });
  }
}

export interface EntitlementsUsage {
  exams_used_this_month: number;
  total_exams_used: number;
}

export interface EntitlementsPayload {
  organization_id: string;
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
  } | null;
  /** The platform admin's switches that are in force now. */
  overrides: Array<{ key: string; value: boolean | number; expires_at: Date | null }>;
}

const CACHE_SECONDS = 5 * 60;
const cacheKey = (organizationId: string) => `ent:${organizationId}`;

/**
 * What an organisation may use (design §8.3): its plan's features and limits (Free when it has
 * no active subscription), then the platform admin's unexpired overrides, plus usage counted from
 * its exams. Cached in Redis for 5 minutes and dropped on any change (`invalidate`).
 */
@Injectable()
export class EntitlementsService {
  private readonly logger = new Logger(EntitlementsService.name);

  constructor(
    @InjectRepository(SubscriptionPlanEntity)
    private readonly planRepo: Repository<SubscriptionPlanEntity>,
    @InjectRepository(AccountSubscriptionEntity)
    private readonly subscriptionRepo: Repository<AccountSubscriptionEntity>,
    @InjectRepository(FeatureOverrideEntity)
    private readonly overrideRepo: Repository<FeatureOverrideEntity>,
    @InjectRepository(ExamEntity)
    private readonly examRepo: Repository<ExamEntity>,
    private readonly redis: RedisService,
  ) {}

  /** Usage comes from the organisation's exams, so it is always right (including older exams). */
  async getUsageCounts(organizationId: string): Promise<EntitlementsUsage> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [totalUsed, monthlyUsed] = await Promise.all([
      this.examRepo.count({ where: { organization_id: organizationId } }),
      this.examRepo.count({ where: { organization_id: organizationId, created_at: MoreThanOrEqual(startOfMonth) } }),
    ]);
    return { exams_used_this_month: monthlyUsed, total_exams_used: totalUsed };
  }

  /** The organisation's ACTIVE subscription; a lapsed one is marked EXPIRED on the way. */
  async findActiveSubscription(organizationId: string): Promise<AccountSubscriptionEntity | null> {
    const subscription = await this.subscriptionRepo.findOne({
      where: { organization_id: organizationId, status: SubscriptionStatusEnum.ACTIVE },
      relations: ['plan'],
      order: { created_at: 'DESC' },
    });

    if (subscription?.end_date && new Date(subscription.end_date) < new Date()) {
      subscription.status = SubscriptionStatusEnum.EXPIRED;
      await this.subscriptionRepo.save(subscription);
      await this.invalidate(organizationId);
      return null;
    }
    return subscription;
  }

  async getFreePlan(): Promise<SubscriptionPlanEntity> {
    const freePlan = await this.planRepo.findOne({ where: { slug: 'free' } });
    if (!freePlan) {
      throw new NotFoundException('Default free plan not found');
    }
    return freePlan;
  }

  async getEntitlements(organizationId: string): Promise<EntitlementsPayload> {
    // Plan and overrides come from the cache; usage is always counted now, so a limit cannot be
    // passed while the cache is warm.
    const cached = await this.readCache(organizationId);
    if (cached) return { ...cached, usage: await this.getUsageCounts(organizationId) };

    const subscription = await this.findActiveSubscription(organizationId);
    const plan = subscription?.plan ?? (await this.getFreePlan());
    const overrides = await this.activeOverrides(organizationId);

    const featureOverrides: PlanFeatures = {};
    const limitOverrides: PlanLimits = {};
    for (const override of overrides) {
      if ((ALL_FEATURE_KEYS as string[]).includes(override.key)) {
        featureOverrides[override.key as FeatureKey] = Boolean(override.value);
      } else if ((ALL_LIMIT_KEYS as string[]).includes(override.key)) {
        limitOverrides[override.key as LimitKey] = Number(override.value);
      }
    }

    const payload: EntitlementsPayload = {
      organization_id: organizationId,
      plan: { id: plan.id, name: plan.name, slug: plan.slug },
      features: mergeFeatures(plan.features ?? {}, featureOverrides),
      limits: mergeLimits(plan.limits ?? {}, limitOverrides),
      usage: await this.getUsageCounts(organizationId),
      subscription: subscription
        ? {
            id: subscription.id,
            status: subscription.status,
            billing_cycle: subscription.billing_cycle,
            start_date: subscription.start_date,
            end_date: subscription.end_date,
          }
        : null,
      overrides: overrides.map((override) => ({ key: override.key, value: override.value, expires_at: override.expires_at })),
    };

    await this.writeCache(organizationId, payload);
    return payload;
  }

  async hasFeature(organizationId: string, key: FeatureKey | string): Promise<boolean> {
    const entitlements = await this.getEntitlements(organizationId);
    return Boolean(entitlements.features[key as FeatureKey]);
  }

  async assertFeature(organizationId: string, key: FeatureKey | string, message?: string): Promise<void> {
    if (!(await this.hasFeature(organizationId, key))) {
      throw new FeatureNotInPlanException(key, message);
    }
  }

  async checkLimit(
    organizationId: string,
    key: LimitKey | string,
    currentValue: number,
  ): Promise<{ allowed: boolean; limit: number; current: number }> {
    const entitlements = await this.getEntitlements(organizationId);
    const limit = entitlements.limits[key as LimitKey] ?? 0;
    // 0 means no limit.
    return { allowed: limit === 0 || currentValue < limit, limit, current: currentValue };
  }

  async assertLimit(organizationId: string, key: LimitKey | string, currentValue: number, message?: string): Promise<void> {
    const result = await this.checkLimit(organizationId, key, currentValue);
    if (!result.allowed) {
      throw new PlanLimitReachedException(
        key,
        message ?? `You have reached your plan limit for "${key}" (${result.limit}). Please upgrade your plan.`,
      );
    }
  }

  async canCreateExam(organizationId: string): Promise<{ allowed: boolean; reason?: string; limit?: string }> {
    const { usage, limits } = await this.getEntitlements(organizationId);

    const totalLimit = limits[LimitKey.MAX_TOTAL_EXAMS] ?? 0;
    if (totalLimit > 0 && usage.total_exams_used >= totalLimit) {
      return {
        allowed: false,
        limit: LimitKey.MAX_TOTAL_EXAMS,
        reason: `You have reached your total exam limit (${totalLimit}). Please upgrade your plan.`,
      };
    }

    const monthlyLimit = limits[LimitKey.MAX_EXAMS_PER_MONTH] ?? 0;
    if (monthlyLimit > 0 && usage.exams_used_this_month >= monthlyLimit) {
      return {
        allowed: false,
        limit: LimitKey.MAX_EXAMS_PER_MONTH,
        reason: `You have reached your monthly exam limit (${monthlyLimit}). Please wait until next month or upgrade your plan.`,
      };
    }

    return { allowed: true };
  }

  /** Drop the cached entitlements of one organisation, or of all of them (a plan changed). */
  async invalidate(organizationId?: string): Promise<void> {
    try {
      if (organizationId) {
        await this.redis.del(cacheKey(organizationId));
      } else {
        const keys = await this.redis.keys(cacheKey('*'));
        if (keys.length) await this.redis.delMultiple(keys);
      }
    } catch (error) {
      this.logger.warn(`Could not clear entitlements cache: ${(error as Error).message}`);
    }
  }

  private async activeOverrides(organizationId: string): Promise<FeatureOverrideEntity[]> {
    const now = new Date();
    const rows = await this.overrideRepo.find({ where: { organization_id: organizationId } });
    return rows.filter((row) => !row.expires_at || new Date(row.expires_at) > now);
  }

  // The cache is a speed-up only: when Redis is down, entitlements are computed every time.
  private async readCache(organizationId: string): Promise<Omit<EntitlementsPayload, 'usage'> | null> {
    try {
      const raw = await this.redis.get(cacheKey(organizationId));
      if (!raw) return null;
      const payload = JSON.parse(raw) as Omit<EntitlementsPayload, 'usage'>;
      // An override that expired while cached must not keep counting.
      const now = Date.now();
      if (payload.overrides.some((override) => override.expires_at && new Date(override.expires_at).getTime() <= now)) {
        return null;
      }
      return payload;
    } catch {
      return null;
    }
  }

  private async writeCache(organizationId: string, payload: EntitlementsPayload): Promise<void> {
    try {
      const { usage: _usage, ...cacheable } = payload;
      await this.redis.set(cacheKey(organizationId), JSON.stringify(cacheable), CACHE_SECONDS);
    } catch (error) {
      this.logger.warn(`Could not cache entitlements: ${(error as Error).message}`);
    }
  }
}
