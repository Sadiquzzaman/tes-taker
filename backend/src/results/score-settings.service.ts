import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AcademicSessionStatusEnum } from 'src/academics/entities/academic-session.entity';
import { SectionsService } from 'src/academics/sections.service';
import { AUDIT_ACTIONS } from 'src/audit/audit-actions';
import { auditChanges } from 'src/audit/audit-sanitize';
import { AuditService } from 'src/audit/audit.service';
import { Tenant } from 'src/common/tenancy/tenant-context';
import { OrganizationMemberRoleEnum } from 'src/organizations/enums/organization-member-role.enum';
import { OrgSettingsService, PerformanceSettings } from 'src/organizations/org-settings.service';
import { SaveScoreWeightsDto, UpdatePerformanceSettingsDto } from './dto/scores.dto';
import { ScoreWeightEntity } from './entities/score-weight.entity';
import { RESULTS_ERRORS } from './results-errors';
import { DEFAULT_WEIGHTS, ScoreWeights, validWeights } from './score-calc';

const { OWNER, ADMIN, ASSISTANT, TEACHER } = OrganizationMemberRoleEnum;
const STAFF = [OWNER, ADMIN, ASSISTANT, TEACHER];
/** Who changes weights and performance settings. */
const EDITORS = [OWNER, ADMIN];

export interface ClassWeights {
  class: { id: string; name: string };
  weights: ScoreWeights;
  is_default: boolean;
}

export interface SessionWeights {
  session: { id: string; name: string; closed: boolean };
  default_weights: ScoreWeights;
  classes: ClassWeights[];
}

type Actor = { id: string };

/**
 * Score weights per class and session (PRF-01) and the organisation's performance settings: the
 * at-risk limits of the class dashboard (PRF-07) and whether students see their position (PRF-10).
 * Staff read them; owners and admins (a solo teacher in their own workspace) change them, and
 * every change is in the audit log. A closed session's weights no longer change.
 */
@Injectable()
export class ScoreSettingsService {
  constructor(
    @InjectRepository(ScoreWeightEntity)
    private readonly weightRepo: Repository<ScoreWeightEntity>,
    private readonly sections: SectionsService,
    private readonly orgSettings: OrgSettingsService,
    private readonly audit: AuditService,
  ) {}

  /** Every class with sections in the session (the default session if none is given) and its weights. */
  async weights(tenant: Tenant, sessionId?: string): Promise<SessionWeights> {
    this.staffOnly(tenant);
    const { session, sections } = await this.sections.listWithClasses(sessionId);
    const rows = await this.weightRepo.find({ where: { organization_id: tenant.organizationId, session_id: session.id } });
    const classes = new Map<string, { id: string; name: string }>();
    for (const section of sections) if (section.class) classes.set(section.class_id, { id: section.class_id, name: section.class.class_name });
    return {
      session: { id: session.id, name: session.name, closed: session.status === AcademicSessionStatusEnum.CLOSED },
      default_weights: { ...DEFAULT_WEIGHTS },
      classes: [...classes.values()].map((item) => {
        const row = rows.find((r) => r.class_id === item.id);
        return { class: item, weights: row ? pick(row) : { ...DEFAULT_WEIGHTS }, is_default: !row };
      }),
    };
  }

  async saveWeights(tenant: Tenant, actor: Actor, dto: SaveScoreWeightsDto): Promise<SessionWeights> {
    this.editorsOnly(tenant);
    const weights = pick(dto);
    if (!validWeights(weights)) throw new BadRequestException({ message: 'Weights must add up to 100', code: RESULTS_ERRORS.WEIGHTS_INVALID });
    const current = await this.weights(tenant, dto.session_id);
    if (current.session.id !== dto.session_id) throw new NotFoundException({ message: 'Session not found', code: RESULTS_ERRORS.NOT_FOUND });
    const known = current.classes.find((c) => c.class.id === dto.class_id);
    if (!known) throw new NotFoundException({ message: 'Class not found in this session', code: RESULTS_ERRORS.NOT_FOUND });
    if (current.session.closed) throw new ConflictException({ message: 'The session is closed', code: RESULTS_ERRORS.SESSION_CLOSED });
    if (JSON.stringify(known.weights) === JSON.stringify(weights) && !known.is_default) return current;

    const existing = await this.weightRepo.findOne({ where: { organization_id: tenant.organizationId, session_id: dto.session_id, class_id: dto.class_id } });
    if (existing) {
      await this.weightRepo.update({ id: existing.id }, { ...weights, updated_by: actor.id, updated_at: new Date() });
    } else {
      await this.weightRepo.save(this.weightRepo.create({ organization_id: tenant.organizationId, session_id: dto.session_id, class_id: dto.class_id, ...weights, created_by: actor.id }));
    }
    this.audit.record({
      action: AUDIT_ACTIONS.SCORE_WEIGHTS,
      organizationId: tenant.organizationId,
      actorId: actor.id,
      entityType: 'score_weights',
      entityId: dto.class_id,
      before: { session_id: dto.session_id, ...known.weights },
      after: { session_id: dto.session_id, ...weights },
    });
    return this.weights(tenant, dto.session_id);
  }

  settings(tenant: Tenant): Promise<PerformanceSettings> {
    this.staffOnly(tenant);
    return this.orgSettings.getPerformance(tenant.organizationId);
  }

  async saveSettings(tenant: Tenant, actor: Actor, dto: UpdatePerformanceSettingsDto): Promise<PerformanceSettings> {
    this.editorsOnly(tenant);
    const changes: Partial<PerformanceSettings> = {};
    if (dto.at_risk) changes.at_risk = { score_pct: dto.at_risk.score_pct, attendance_pct: dto.at_risk.attendance_pct, missing_homework: dto.at_risk.missing_homework };
    if (dto.show_rank !== undefined) changes.show_rank = dto.show_rank;
    if (Object.keys(changes).length === 0) return this.orgSettings.getPerformance(tenant.organizationId);
    const { before, after } = await this.orgSettings.savePerformance(tenant.organizationId, actor.id, changes);
    const diff = auditChanges(before, after);
    if (diff.after) {
      this.audit.record({
        action: AUDIT_ACTIONS.PERFORMANCE_SETTINGS,
        organizationId: tenant.organizationId,
        actorId: actor.id,
        entityType: 'org_settings',
        entityId: tenant.organizationId,
        before: diff.before,
        after: diff.after,
      });
    }
    return after;
  }

  private staffOnly(tenant: Tenant): void {
    if (tenant.viaEnrolment || !STAFF.includes(tenant.memberRole)) {
      throw new ForbiddenException({ message: 'Only staff of this workspace see performance settings', code: RESULTS_ERRORS.NOT_ALLOWED });
    }
  }

  private editorsOnly(tenant: Tenant): void {
    if (tenant.viaEnrolment || !EDITORS.includes(tenant.memberRole)) {
      throw new ForbiddenException({ message: 'Only owners and admins change performance settings', code: RESULTS_ERRORS.NOT_ALLOWED });
    }
  }
}

const pick = (w: ScoreWeights): ScoreWeights => ({ exams_pct: w.exams_pct, homework_pct: w.homework_pct, attendance_pct: w.attendance_pct, behaviour_pct: w.behaviour_pct });
