import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { AcademicSessionStatusEnum } from 'src/academics/entities/academic-session.entity';
import { CourseOfferingEntity } from 'src/academics/entities/course-offering.entity';
import { OfferingRosterService } from 'src/academics/offering-roster.service';
import { SectionsService } from 'src/academics/sections.service';
import { AUDIT_ACTIONS } from 'src/audit/audit-actions';
import { AuditService } from 'src/audit/audit.service';
import { Tenant } from 'src/common/tenancy/tenant-context';
import { schoolDateIn } from 'src/common/utils/school-date.util';
import { OrganizationMemberRoleEnum } from 'src/organizations/enums/organization-member-role.enum';
import { OrgSettingsService } from 'src/organizations/org-settings.service';
import { BehaviourCriterionInputDto, BehaviourRowDto } from './dto/behaviour.dto';
import { BehaviourCriterionEntity } from './entities/behaviour-criterion.entity';
import { BehaviourRatingEntity } from './entities/behaviour-rating.entity';
import { RESULTS_ERRORS } from './results-errors';

const { OWNER, ADMIN, ASSISTANT, TEACHER } = OrganizationMemberRoleEnum;
/** Staff who rate in every subject class; teachers in the subject classes they teach. */
const MANAGERS = [OWNER, ADMIN, ASSISTANT];
/** Who changes the criteria list. */
const CRITERIA_EDITORS = [OWNER, ADMIN];

/** The criteria every organisation starts with (PRF-04). */
export const DEFAULT_CRITERIA = [
  { name_en: 'Participation', name_bn: 'অংশগ্রহণ' },
  { name_en: 'Discipline', name_bn: 'শৃঙ্খলা' },
  { name_en: 'Attentiveness', name_bn: 'মনোযোগ' },
];

type Actor = { id: string; full_name?: string | null };

export interface CriterionView {
  id: string;
  name_en: string;
  name_bn: string;
}

export interface BehaviourGrid {
  offering: { id: string; subject: { id: string; name: string }; section: { id: string; name: string; class_name: string | null } };
  date: string;
  criteria: CriterionView[];
  rows: { student: { id: string; full_name: string; roll_no: string | null }; ratings: Record<string, number>; remark: string | null }[];
  can_edit: boolean;
}

/** A student's behaviour in a subject class over a period, for the scores read (Epic 3). */
export interface BehaviourAverage {
  student_id: string;
  offering_id: string;
  subject_id: string;
  /** Mean rating, 1–5, two decimals. */
  average: number;
  /** average ÷ 5, as a percentage with two decimals. */
  percent: number;
  ratings: number;
}

/**
 * Class behaviour (P7-01, PRF-04): each organisation's criteria (participation, discipline and
 * attentiveness to start with; owners and admins change the list), and a grid per subject class
 * and date where its teachers (or the owner, an admin or staff) rate each student 1–5 with an
 * optional remark, as often as they like; the term average is what counts.
 */
@Injectable()
export class BehaviourService {
  constructor(
    @InjectRepository(BehaviourCriterionEntity)
    private readonly criterionRepo: Repository<BehaviourCriterionEntity>,
    @InjectRepository(BehaviourRatingEntity)
    private readonly ratingRepo: Repository<BehaviourRatingEntity>,
    private readonly dataSource: DataSource,
    private readonly sections: SectionsService,
    private readonly roster: OfferingRosterService,
    private readonly orgSettings: OrgSettingsService,
    private readonly audit: AuditService,
  ) {}

  /** The criteria list for its page: staff of the workspace only (students never rate). */
  async criteriaForStaff(tenant: Tenant): Promise<CriterionView[]> {
    if (tenant.viaEnrolment || ![...MANAGERS, TEACHER].includes(tenant.memberRole)) this.notAllowed();
    return this.criteria(tenant);
  }

  /** The organisation's criteria in order; the defaults are added the first time. */
  async criteria(tenant: Tenant): Promise<CriterionView[]> {
    const organizationId = tenant.organizationId;
    let rows = await this.criterionRepo.find({ where: { organization_id: organizationId, is_active: true }, order: { sort_order: 'ASC', created_at: 'ASC' } });
    if (rows.length === 0 && (await this.criterionRepo.count({ where: { organization_id: organizationId } })) === 0) {
      await this.criterionRepo.save(DEFAULT_CRITERIA.map((c, i) => this.criterionRepo.create({ organization_id: organizationId, ...c, sort_order: i })));
      rows = await this.criterionRepo.find({ where: { organization_id: organizationId, is_active: true }, order: { sort_order: 'ASC' } });
    }
    return rows.map(view);
  }

  /** Replaces the list (owners and admins): renames and reorders, adds new ones, retires the ones left out. */
  async saveCriteria(tenant: Tenant, actor: Actor, input: BehaviourCriterionInputDto[]): Promise<CriterionView[]> {
    if (tenant.viaEnrolment || !CRITERIA_EDITORS.includes(tenant.memberRole)) this.notAllowed();
    const before = await this.criteria(tenant);
    const names = input.map((c) => ({ en: c.name_en.trim(), bn: c.name_bn.trim() }));
    const distinct = (values: string[]) => new Set(values.map((v) => v.toLowerCase())).size === values.length;
    if (names.some((n) => !n.en || !n.bn) || !distinct(names.map((n) => n.en)) || !distinct(names.map((n) => n.bn))) {
      throw new BadRequestException({ message: 'Each criterion needs a distinct name in English and Bangla', code: RESULTS_ERRORS.CRITERIA_INVALID });
    }
    const known = new Map(before.map((c) => [c.id, c]));
    if (input.some((c) => c.id && !known.has(c.id))) throw new BadRequestException({ message: 'Unknown criterion', code: RESULTS_ERRORS.CRITERIA_INVALID });
    const now = new Date();
    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(BehaviourCriterionEntity);
      const kept = new Set(input.map((c) => c.id).filter(Boolean));
      const retired = before.filter((c) => !kept.has(c.id)).map((c) => c.id);
      if (retired.length) await repo.update({ id: In(retired), organization_id: tenant.organizationId }, { is_active: false, retired_at: now, retired_by: actor.id });
      for (const [index, c] of input.entries()) {
        if (c.id) await repo.update({ id: c.id, organization_id: tenant.organizationId }, { name_en: names[index].en, name_bn: names[index].bn, sort_order: index });
        else await repo.save(repo.create({ organization_id: tenant.organizationId, name_en: names[index].en, name_bn: names[index].bn, sort_order: index, created_by: actor.id }));
      }
    });
    const after = await this.criteria(tenant);
    this.audit.record({
      action: AUDIT_ACTIONS.BEHAVIOUR_CRITERIA,
      organizationId: tenant.organizationId,
      actorId: actor.id,
      entityType: 'behaviour_criteria',
      entityId: tenant.organizationId,
      before: { criteria: before.map((c) => c.name_en) },
      after: { criteria: after.map((c) => c.name_en) },
    });
    return after;
  }

  /** Everyone taking the subject class with their ratings and remark on that date. */
  async grid(tenant: Tenant, userId: string, offeringId: string, date: string): Promise<BehaviourGrid> {
    const { offering, canEdit } = await this.access(tenant, userId, offeringId);
    const [criteria, students, ratings] = await Promise.all([
      this.criteria(tenant),
      this.roster.students(offering),
      this.ratingRepo.find({ where: { organization_id: tenant.organizationId, offering_id: offering.id, rated_on: date } }),
    ]);
    return {
      offering: {
        id: offering.id,
        subject: { id: offering.subject?.id ?? offering.subject_id, name: offering.subject?.name ?? '' },
        section: { id: offering.section?.id ?? offering.section_id, name: offering.section?.name ?? '', class_name: offering.section?.class?.class_name ?? null },
      },
      date,
      criteria,
      rows: students.map((s) => {
        const own = ratings.filter((r) => r.student_id === s.student_id);
        return {
          student: { id: s.student_id, full_name: s.full_name, roll_no: s.roll_no },
          ratings: Object.fromEntries(own.map((r) => [r.criterion_id, r.rating])),
          remark: own.find((r) => r.remark)?.remark ?? null,
        };
      }),
      can_edit: canEdit,
    };
  }

  /** Saves a day's ratings (and remarks); a criterion left empty keeps whatever it had. */
  async save(tenant: Tenant, actor: Actor, offeringId: string, date: string, rows: BehaviourRowDto[]): Promise<BehaviourGrid> {
    const { offering, canEdit } = await this.access(tenant, actor.id, offeringId);
    if (!canEdit) {
      if (offering.session?.status === AcademicSessionStatusEnum.CLOSED) throw new ConflictException({ message: 'The session is closed', code: RESULTS_ERRORS.SESSION_CLOSED });
      this.notAllowed();
    }
    const today = schoolDateIn(await this.orgSettings.timeZone(tenant.organizationId), new Date());
    const invalid = (message: string, details?: unknown) => new BadRequestException({ message, code: RESULTS_ERRORS.RATING_INVALID, details });
    if (date > today) throw invalid('Rate on today or an earlier day');
    const criteria = new Set((await this.criteria(tenant)).map((c) => c.id));
    const taking = new Set((await this.roster.students(offering)).map((s) => s.student_id));
    for (const [index, row] of rows.entries()) {
      if (!taking.has(row.student_id)) {
        throw new BadRequestException({ message: 'The student does not take this subject class', code: RESULTS_ERRORS.STUDENT_NOT_IN_CLASS, details: { index } });
      }
      for (const [criterionId, rating] of Object.entries(row.ratings)) {
        if (!criteria.has(criterionId)) throw invalid('Unknown criterion', { index });
        if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) throw invalid('Ratings are 1 to 5', { index });
      }
    }

    const changes: { studentId: string; before: Record<string, number>; after: Record<string, number>; remark: string | null }[] = [];
    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(BehaviourRatingEntity);
      for (const row of rows) {
        const existing = await repo.find({ where: { organization_id: tenant.organizationId, offering_id: offering.id, student_id: row.student_id, rated_on: date } });
        const before = Object.fromEntries(existing.map((r) => [r.criterion_id, r.rating]));
        const remark = row.remark === undefined ? (existing.find((r) => r.remark)?.remark ?? null) : row.remark?.trim() || null;
        const after = { ...before };
        for (const [criterionId, rating] of Object.entries(row.ratings)) if (rating !== null) after[criterionId] = rating;
        const remarkBefore = existing.find((r) => r.remark)?.remark ?? null;
        if (remark && Object.keys(after).length === 0) {
          throw new BadRequestException({ message: 'Give at least one rating with a remark', code: RESULTS_ERRORS.REMARK_NEEDS_RATING, details: { index: rows.indexOf(row) } });
        }
        if (JSON.stringify(before) === JSON.stringify(after) && remark === remarkBefore) continue;
        for (const [criterionId, rating] of Object.entries(after)) {
          const found = existing.find((r) => r.criterion_id === criterionId);
          if (found) {
            if (found.rating !== rating || found.remark !== remark) await repo.update({ id: found.id }, { rating, remark, rated_by: actor.id, rated_at: new Date() });
          } else {
            await repo.save(
              repo.create({ organization_id: tenant.organizationId, offering_id: offering.id, student_id: row.student_id, criterion_id: criterionId, rating, remark, rated_on: date, rated_by: actor.id }),
            );
          }
        }
        changes.push({ studentId: row.student_id, before, after, remark });
      }
    });
    if (changes.length) {
      this.audit.recordMany(
        changes.map((change) => ({
          action: AUDIT_ACTIONS.BEHAVIOUR_RATE,
          organizationId: tenant.organizationId,
          actorId: actor.id,
          entityType: 'behaviour_rating',
          entityId: offering.id,
          before: Object.keys(change.before).length ? { student_id: change.studentId, date, ratings: change.before } : null,
          after: { student_id: change.studentId, date, ratings: change.after, remark: change.remark },
        })),
      );
    }
    return this.grid(tenant, actor.id, offering.id, date);
  }

  /**
   * Each student's mean rating per subject class between two school dates (retired criteria
   * included: they were rated then), for the scores read. No access check: the caller checks.
   */
  async averagesOf(organizationId: string, studentIds: string[], from: string, to: string): Promise<BehaviourAverage[]> {
    if (studentIds.length === 0) return [];
    const rows: { student_id: string; offering_id: string; subject_id: string; average: string; ratings: number }[] = await this.dataSource.query(
      `SELECT r.student_id, r.offering_id, o.subject_id, avg(r.rating) AS average, count(*)::int AS ratings
         FROM behaviour_ratings r JOIN course_offerings o ON o.id = r.offering_id
        WHERE r.organization_id = $1 AND r.student_id = ANY($2) AND r.rated_on BETWEEN $3 AND $4
        GROUP BY 1, 2, 3`,
      [organizationId, studentIds, from, to],
    );
    return rows.map((row) => {
      const average = Math.round(Number(row.average) * 100) / 100;
      return { ...row, average, percent: Math.round((Number(row.average) / 5) * 10_000) / 100 };
    });
  }

  /** The subject class, and whether the caller may rate in it (staff of an open session). */
  private async access(tenant: Tenant, userId: string, offeringId: string): Promise<{ offering: CourseOfferingEntity; canEdit: boolean }> {
    if (tenant.viaEnrolment || ![...MANAGERS, TEACHER].includes(tenant.memberRole)) this.notAllowed();
    const [found] = await this.sections.offeringsWithTeachers(tenant.organizationId, [offeringId]);
    if (!found) throw new NotFoundException({ message: 'Subject class not found', code: RESULTS_ERRORS.NOT_FOUND });
    if (!MANAGERS.includes(tenant.memberRole) && !found.teacherIds.includes(userId)) {
      throw new NotFoundException({ message: 'Subject class not found', code: RESULTS_ERRORS.NOT_FOUND });
    }
    return { offering: found.offering, canEdit: found.offering.session?.status !== AcademicSessionStatusEnum.CLOSED };
  }

  private notAllowed(): never {
    throw new ForbiddenException({ message: 'Only staff of this workspace rate behaviour', code: RESULTS_ERRORS.NOT_ALLOWED });
  }
}

const view = (c: BehaviourCriterionEntity): CriterionView => ({ id: c.id, name_en: c.name_en, name_bn: c.name_bn });
