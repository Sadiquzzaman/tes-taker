import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { tenantScoped } from 'src/common/tenancy/tenant-repository';
import { TenantContext } from 'src/common/tenancy/tenant-context';
import { ClassEntity } from 'src/classes/entities/class.entity';
import { ClassSubjectEntity } from 'src/classes/entities/class-subject.entity';
import { OrganizationKindEnum } from 'src/organizations/enums/organization-kind.enum';
import { BranchesService } from 'src/organizations/branches.service';
import { OrgSettingsService } from 'src/organizations/org-settings.service';
import { FeatureKey } from 'src/subscriptions/constants/feature-catalog';
import { EntitlementsService } from 'src/subscriptions/entitlements.service';
import { activeEnrolmentCondition } from './enrolment-queries';
import { EnrolmentEntity } from './entities/enrolment.entity';
import { AcademicSessionsService } from './academic-sessions.service';
import { SectionEntity } from './entities/section.entity';

export interface SetupClassView {
  id: string;
  name: string;
  subject_count: number;
  section_count: number;
  /** Students in the class in the default session. */
  student_count: number;
  /** Subjects that have no teacher in at least one of the class's sections (names, sorted). */
  subjects_without_teacher: string[];
}

export interface SetupSummary {
  setup_completed_at: Date | null;
  /** The default session, where the wizard sets up sections. */
  session: { id: string; name: string; start_date: string; end_date: string };
  classes: SetupClassView[];
  /** With attendance on: in-person check-in needs the school's location (pin), which is not set yet. */
  checkin_pin_missing: boolean;
}

/**
 * The academic setup wizard (P2-04, FND-02) of a school or coaching centre: what is set up so far,
 * and finishing it. The structure itself is written through the class and section endpoints.
 */
@Injectable()
export class AcademicSetupService {
  constructor(
    @InjectRepository(ClassEntity)
    private readonly classRepo: Repository<ClassEntity>,
    @InjectRepository(ClassSubjectEntity)
    private readonly classSubjectRepo: Repository<ClassSubjectEntity>,
    @InjectRepository(SectionEntity)
    private readonly sectionRepo: Repository<SectionEntity>,
    @InjectRepository(EnrolmentEntity)
    private readonly enrolmentRepo: Repository<EnrolmentEntity>,
    private readonly sessions: AcademicSessionsService,
    private readonly settings: OrgSettingsService,
    private readonly branches: BranchesService,
    private readonly entitlements: EntitlementsService,
  ) {}

  async summary(): Promise<SetupSummary> {
    const organizationId = this.requireOrganisation();
    const session = await this.sessions.ensureDefault(organizationId);
    const classes = (await tenantScoped(this.classRepo).find()).sort((a, b) => a.class_name.localeCompare(b.class_name, 'en', { numeric: true, sensitivity: 'base' }));
    const ids = classes.map((c) => c.id);
    const [subjects, sections]: [ClassSubjectEntity[], SectionEntity[]] = ids.length
      ? await Promise.all([
          this.classSubjectRepo.find({ where: { class_id: In(ids) }, select: ['id', 'class_id'] }),
          tenantScoped(this.sectionRepo).find({ where: { class_id: In(ids), session_id: session.id }, select: ['id', 'class_id'] }),
        ])
      : [[], []];
    const settings = await this.settings.get(organizationId);
    const [students, untaught, pinMissing] = await Promise.all([
      this.studentCounts(organizationId, session.id),
      this.subjectsWithoutTeacher(organizationId, session.id),
      this.checkinPinMissing(organizationId),
    ]);
    return {
      setup_completed_at: settings.setup_completed_at,
      session: { id: session.id, name: session.name, start_date: session.start_date, end_date: session.end_date },
      classes: classes.map((c) => ({
        id: c.id,
        name: c.class_name,
        subject_count: subjects.filter((s) => s.class_id === c.id).length,
        section_count: sections.filter((s) => s.class_id === c.id).length,
        student_count: students.get(c.id) ?? 0,
        subjects_without_teacher: untaught.get(c.id) ?? [],
      })),
      checkin_pin_missing: pinMissing,
    };
  }

  /** Finishes the setup: at least one class, and every class has a section in the default session. */
  async complete(userId: string): Promise<SetupSummary> {
    const organizationId = this.requireOrganisation();
    const summary = await this.summary();
    if (summary.classes.length === 0) {
      throw new BadRequestException('Add at least one class before finishing the setup');
    }
    const withoutSection = summary.classes.find((c) => c.section_count === 0);
    if (withoutSection) {
      throw new BadRequestException(`Add a section to ${withoutSection.name} before finishing the setup`);
    }
    await this.settings.markSetupComplete(organizationId, userId);
    return this.summary();
  }

  /** Students of each class in the session, by class id. */
  private async studentCounts(organizationId: string, sessionId: string): Promise<Map<string, number>> {
    const active = activeEnrolmentCondition('e', sessionId);
    const rows: { class_id: string; n: number }[] = await this.enrolmentRepo
      .createQueryBuilder('e')
      .select('e.class_id', 'class_id')
      .addSelect('COUNT(DISTINCT e.student_id)::int', 'n')
      .where('e.organization_id = :organizationId', { organizationId })
      .andWhere(active.sql, active.params)
      .groupBy('e.class_id')
      .getRawMany();
    return new Map(rows.map((row) => [row.class_id, Number(row.n)]));
  }

  /** Each class's subjects with no teacher in at least one of its sections of the session, by class id. */
  private async subjectsWithoutTeacher(organizationId: string, sessionId: string): Promise<Map<string, string[]>> {
    const rows: { class_id: string; name: string }[] = await this.enrolmentRepo.manager.query(
      `SELECT DISTINCT s.class_id, sub.name
         FROM course_offerings o
         JOIN sections s ON s.id = o.section_id
         JOIN subjects sub ON sub.id = o.subject_id
        WHERE o.organization_id = $1 AND o.session_id = $2
          AND NOT EXISTS (SELECT 1 FROM offering_teachers t WHERE t.offering_id = o.id)`,
      [organizationId, sessionId],
    );
    const map = new Map<string, string[]>();
    for (const row of rows) map.set(row.class_id, [...(map.get(row.class_id) ?? []), row.name].sort((a, b) => a.localeCompare(b)));
    return map;
  }

  /** In-person check-in needs the organisation's pin (its default branch); only asked with attendance on. */
  private async checkinPinMissing(organizationId: string): Promise<boolean> {
    if (!(await this.entitlements.hasFeature(organizationId, FeatureKey.ATTENDANCE))) return false;
    const branch = await this.branches.defaultBranch(organizationId);
    return branch.geo_lat === null;
  }

  /** Schools and coaching centres only: a solo teacher's workspace has no setup wizard (owner decision). */
  private requireOrganisation(): string {
    const tenant = TenantContext.current();
    if (!tenant) throw new BadRequestException('Choose a workspace first');
    if (tenant.kind === OrganizationKindEnum.SOLO) {
      throw new BadRequestException('The setup wizard is for schools and coaching centres');
    }
    return tenant.organizationId;
  }
}
