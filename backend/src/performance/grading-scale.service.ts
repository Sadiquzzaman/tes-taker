import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, IsNull, Repository } from 'typeorm';
import { AUDIT_ACTIONS } from 'src/audit/audit-actions';
import { AuditService } from 'src/audit/audit.service';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';
import { ActiveStatusEnum } from 'src/common/enums/active-status.enum';
import { isUniqueViolation } from 'src/common/utils/db-error.util';
import { UpdateGradingScaleDto } from './dto/grading-scale.dto';
import { GradingBandEntity } from './entities/grading-band.entity';
import { GradingScaleEntity } from './entities/grading-scale.entity';
import {
  BANGLADESH_NATIONAL_BANDS,
  BANGLADESH_NATIONAL_NAME,
  Grade,
  GradeBand,
  gradeForPercentage,
  GRADING_SCALE_ERRORS,
  GradingScaleErrorCode,
  normalizeGradeBands,
  validateGradeBands,
} from './grading-scale.util';

/** A scale as the API returns it. `is_custom` is false while the organisation uses the platform default. */
export interface GradingScaleView {
  name: string;
  is_custom: boolean;
  bands: GradeBand[];
  updated_at: Date | null;
}

type Actor = Pick<JwtPayloadInterface, 'id' | 'full_name'>;

const CUSTOM_SCALE_NAME = 'Custom';

/**
 * The grading scale of each organisation (FND-11): its own active scale, or the platform default
 * (Bangladesh national). Grades are worked out when a result is read, never stored, so changing
 * the scale regrades everything at once and never touches raw marks.
 */
@Injectable()
export class GradingScaleService {
  constructor(
    @InjectRepository(GradingScaleEntity)
    private readonly scaleRepo: Repository<GradingScaleEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  /** The scale an organisation's marks are graded on. A null organisation (pre-P2-01 rows) uses the default. */
  async getScale(organizationId: string | null): Promise<GradingScaleView> {
    return (await this.getScales([organizationId])).get(organizationId) as GradingScaleView;
  }

  /** The scales of several organisations at once (e.g. a student's results across workspaces). */
  async getScales(organizationIds: Array<string | null>): Promise<Map<string | null, GradingScaleView>> {
    const orgIds = [...new Set(organizationIds.filter((id): id is string => Boolean(id)))];
    const custom = orgIds.length
      ? await this.scaleRepo.find({
          where: { organization_id: In(orgIds), is_active: ActiveStatusEnum.ACTIVE },
          relations: ['bands'],
        })
      : [];
    const byOrg = new Map(custom.map((scale) => [scale.organization_id, scale]));
    const fallback = orgIds.length > byOrg.size || organizationIds.some((id) => !id) ? await this.platformDefault() : null;

    const result = new Map<string | null, GradingScaleView>();
    for (const id of new Set(organizationIds)) {
      const own = id ? byOrg.get(id) : undefined;
      result.set(id, own ? this.toView(own, true) : (fallback as GradingScaleView));
    }
    return result;
  }

  /** The grade for a percentage on the organisation's scale. */
  async gradeFor(organizationId: string | null, percentage: number | null | undefined): Promise<Grade | null> {
    return gradeForPercentage((await this.getScale(organizationId)).bands, percentage);
  }

  /** Saves new bands for the organisation. The current scale is kept, deactivated, as history. */
  async replace(organizationId: string, dto: UpdateGradingScaleDto, actor: Actor): Promise<GradingScaleView> {
    const bands: GradeBand[] = dto.bands.map((band) => ({ ...band, gpa: band.gpa ?? null }));
    const problem = validateGradeBands(bands);
    if (problem) {
      throw new BadRequestException({ message: this.describe(problem.code, problem.band), code: problem.code });
    }
    const normalized = normalizeGradeBands(bands);
    const before = await this.getScale(organizationId);

    let scaleId: string;
    try {
      scaleId = await this.dataSource.transaction(async (manager) => {
        const current = await this.deactivateCurrent(manager, organizationId, actor);
        const scale = await manager.getRepository(GradingScaleEntity).save({
          organization_id: organizationId,
          name: dto.name?.trim() || current?.name || CUSTOM_SCALE_NAME,
          is_default: false,
          created_by: actor.id,
          created_user_name: actor.full_name?.slice(0, 100),
          created_at: new Date(),
        } as Partial<GradingScaleEntity>);
        await manager.getRepository(GradingBandEntity).insert(
          normalized.map((band) => ({
            scale_id: scale.id,
            min_pct: String(band.min_pct),
            max_pct: String(band.max_pct),
            grade: band.grade,
            gpa: band.gpa === null ? null : String(band.gpa),
            created_by: actor.id,
            created_user_name: actor.full_name?.slice(0, 100),
            created_at: new Date(),
          })),
        );
        return scale.id;
      });
    } catch (error) {
      if (isUniqueViolation(error, 'UQ_grading_scales_active_org')) {
        throw new ConflictException({ message: 'The grading scale was changed at the same time; reload and try again', code: 'GRADING_SCALE_CONFLICT' });
      }
      throw error;
    }

    const after = await this.getScale(organizationId);
    this.audit.record({
      action: AUDIT_ACTIONS.GRADING_SCALE_UPDATE,
      organizationId,
      actorId: actor.id,
      entityType: 'grading_scale',
      entityId: scaleId,
      before: this.auditState(before),
      after: this.auditState(after),
    });
    return after;
  }

  /** Back to the platform default. The organisation's scale is deactivated, not deleted. */
  async reset(organizationId: string, actor: Actor): Promise<GradingScaleView> {
    const before = await this.getScale(organizationId);
    const removed = await this.dataSource.transaction((manager) => this.deactivateCurrent(manager, organizationId, actor));
    const after = await this.getScale(organizationId);
    if (removed) {
      this.audit.record({
        action: AUDIT_ACTIONS.GRADING_SCALE_RESET,
        organizationId,
        actorId: actor.id,
        entityType: 'grading_scale',
        entityId: removed.id,
        before: this.auditState(before),
        after: this.auditState(after),
      });
    }
    return after;
  }

  private async deactivateCurrent(manager: EntityManager, organizationId: string, actor: Actor): Promise<GradingScaleEntity | null> {
    const repo = manager.getRepository(GradingScaleEntity);
    const current = await repo.findOne({
      where: { organization_id: organizationId, is_active: ActiveStatusEnum.ACTIVE },
      lock: { mode: 'pessimistic_write' },
    });
    if (!current) return null;
    await repo.update(
      { id: current.id },
      {
        is_active: ActiveStatusEnum.INACTIVE,
        deactivated_at: new Date(),
        deactivated_by: actor.id,
        updated_by: actor.id,
        updated_user_name: actor.full_name?.slice(0, 100),
        updated_at: new Date(),
      },
    );
    return current;
  }

  /** The seeded platform default, or the built-in Bangladesh scale if that row is missing. */
  private async platformDefault(): Promise<GradingScaleView> {
    const scale = await this.scaleRepo.findOne({
      where: { organization_id: IsNull(), is_default: true, is_active: ActiveStatusEnum.ACTIVE },
      relations: ['bands'],
    });
    if (scale?.bands?.length) return this.toView(scale, false);
    return { name: BANGLADESH_NATIONAL_NAME, is_custom: false, bands: BANGLADESH_NATIONAL_BANDS, updated_at: null };
  }

  private toView(scale: GradingScaleEntity, isCustom: boolean): GradingScaleView {
    const bands = scale.bands.map((band) => ({
      min_pct: Number(band.min_pct),
      max_pct: Number(band.max_pct),
      grade: band.grade,
      gpa: band.gpa === null ? null : Number(band.gpa),
    }));
    return {
      name: scale.name,
      is_custom: isCustom,
      bands: normalizeGradeBands(bands),
      updated_at: scale.updated_at ?? scale.created_at ?? null,
    };
  }

  private auditState(view: GradingScaleView) {
    return {
      name: view.name,
      is_custom: view.is_custom,
      bands: view.bands.map((band) => `${band.min_pct}–${band.max_pct} ${band.grade}${band.gpa === null ? '' : ` (${band.gpa})`}`),
    };
  }

  private describe(code: GradingScaleErrorCode, band?: number): string {
    const where = band === undefined ? '' : ` (band ${band + 1})`;
    switch (code) {
      case GRADING_SCALE_ERRORS.EMPTY:
        return 'Add at least one band';
      case GRADING_SCALE_ERRORS.TOO_MANY:
        return 'A scale can have at most 20 bands';
      case GRADING_SCALE_ERRORS.START:
        return `The lowest band must start at 0%${where}`;
      case GRADING_SCALE_ERRORS.END:
        return `The highest band must end at 100%${where}`;
      case GRADING_SCALE_ERRORS.GAP_OR_OVERLAP:
        return `Each band must start 0.01% above the one below it, with no gap or overlap${where}`;
      case GRADING_SCALE_ERRORS.DUPLICATE_GRADE:
        return `Each grade can be used once${where}`;
      default:
        return `A band needs a grade (up to 5 characters), percentages from 0 to 100 with up to two decimals, From not above To, and a GPA from 0 to 9.99${where}`;
    }
  }
}
