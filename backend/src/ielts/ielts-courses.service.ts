import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import { AcademicSessionsService } from 'src/academics/academic-sessions.service';
import { SectionsService } from 'src/academics/sections.service';
import { ClassService } from 'src/classes/class.service';
import { AUDIT_ACTIONS } from 'src/audit/audit-actions';
import { AuditService } from 'src/audit/audit.service';
import { Tenant } from 'src/common/tenancy/tenant-context';
import { schoolDateIn } from 'src/common/utils/school-date.util';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';
import { BranchesService } from 'src/organizations/branches.service';
import { BranchEntity } from 'src/organizations/entities/branch.entity';
import { OrganizationMemberRoleEnum } from 'src/organizations/enums/organization-member-role.enum';
import { OrganizationKindEnum } from 'src/organizations/enums/organization-kind.enum';
import { OrgSettingsService } from 'src/organizations/org-settings.service';
import { IeltsCourseEntity } from './entities/ielts-course.entity';
import { IeltsModuleEnum } from './entities/ielts-profile.entity';
import { IeltsProfilesService } from './ielts-profiles.service';

/** The fixed subjects that carry an IELTS course's modules (their subject classes hold the module teachers). */
const MODULE_SUBJECTS: Record<IeltsModuleEnum, { name: string; code: string }> = {
  [IeltsModuleEnum.LISTENING]: { name: 'Listening', code: 'IELTS-L' },
  [IeltsModuleEnum.READING]: { name: 'Reading', code: 'IELTS-R' },
  [IeltsModuleEnum.WRITING]: { name: 'Writing', code: 'IELTS-W' },
  [IeltsModuleEnum.SPEAKING]: { name: 'Speaking', code: 'IELTS-S' },
};
const MODULE_ORDER = [IeltsModuleEnum.LISTENING, IeltsModuleEnum.READING, IeltsModuleEnum.WRITING, IeltsModuleEnum.SPEAKING];

export type CourseStatus = 'UPCOMING' | 'RUNNING' | 'ENDED';

export interface CourseView {
  id: string;
  title: string;
  branch: { id: string; name: string | null; is_default: boolean } | null;
  start_date: string;
  end_date: string;
  status: CourseStatus;
  modules: IeltsModuleEnum[];
  seat_limit: number | null;
  students: number;
  teachers: { module: IeltsModuleEnum; offering_id: string | null; teachers: { id: string; full_name: string | null }[] }[];
  class_id: string;
  session_id: string;
  section_id: string;
}

export interface CourseInput {
  title?: string;
  branch_id?: string | null;
  start_date?: string;
  end_date?: string;
  modules?: IeltsModuleEnum[];
  seat_limit?: number | null;
  /** Teachers per module; a module left out keeps its teachers. */
  teachers?: Partial<Record<IeltsModuleEnum, string[]>>;
}

const MANAGERS = [OrganizationMemberRoleEnum.OWNER, OrganizationMemberRoleEnum.ADMIN, OrganizationMemberRoleEnum.BRANCH_MANAGER];

/**
 * IELTS courses (P12-04, IEL-13). A course is made through the academic engine: a class (which
 * comes with an empty section), its own session with the course's dates, the section moved into it
 * at the course's branch with the seat limit, and a subject class per module whose teachers teach
 * that module. Students, timetable, attendance, homework, chat and IELTS openings use the section.
 *
 * Who: owners and admins (and a solo trainer) run every course; a branch manager the courses of
 * their branch; a teacher reads the courses they teach; a student the courses they are enrolled in,
 * and an ended one only for `org_settings.ended_course_visible_days`.
 */
@Injectable()
export class IeltsCoursesService {
  constructor(
    @InjectRepository(IeltsCourseEntity)
    private readonly courseRepo: Repository<IeltsCourseEntity>,
    private readonly dataSource: DataSource,
    private readonly profiles: IeltsProfilesService,
    private readonly classes: ClassService,
    private readonly sessions: AcademicSessionsService,
    private readonly sections: SectionsService,
    private readonly branches: BranchesService,
    private readonly orgSettings: OrgSettingsService,
    private readonly audit: AuditService,
  ) {}

  async list(tenant: Tenant, userId: string, filter: { branch_id?: string } = {}): Promise<CourseView[]> {
    await this.profiles.assertIeltsCentre(tenant);
    const qb = this.courseRepo
      .createQueryBuilder('c')
      .where('c.organization_id = :org AND c.deleted_at IS NULL', { org: tenant.organizationId })
      .orderBy('c.start_date', 'DESC')
      .addOrderBy('c.title', 'ASC');
    if (tenant.branchId) qb.andWhere('c.branch_id = :mine', { mine: tenant.branchId });
    if (filter.branch_id) qb.andWhere('c.branch_id = :branch', { branch: filter.branch_id });
    if (!this.isManager(tenant)) {
      const sectionIds = await this.visibleSectionIds(tenant, userId);
      if (sectionIds.length === 0) return [];
      qb.andWhere('c.section_id IN (:...sectionIds)', { sectionIds });
    }
    const courses = await qb.getMany();
    const views = await this.views(tenant.organizationId, courses);
    return this.isStudent(tenant) ? this.visibleToStudents(tenant.organizationId, views) : views;
  }

  async get(tenant: Tenant, userId: string, id: string): Promise<CourseView> {
    const [course] = (await this.list(tenant, userId)).filter((view) => view.id === id);
    if (!course) throw new NotFoundException('Course not found');
    return course;
  }

  async create(tenant: Tenant, user: JwtPayloadInterface, input: CourseInput): Promise<CourseView> {
    await this.profiles.assertIeltsCentre(tenant);
    this.assertManager(tenant);
    const title = this.title(input.title);
    const { start_date, end_date } = this.dates(input.start_date, input.end_date);
    const modules = this.modules(input.modules);
    const seat_limit = this.seatLimit(input.seat_limit);
    const branch = await this.branchFor(tenant, input.branch_id);

    const actor = { id: user.id, full_name: user.full_name };
    // A solo trainer's classes are personal classes of their own workspace.
    const classEntity = await this.classes.createCourseClass(tenant.organizationId, title, actor, tenant.kind === OrganizationKindEnum.SOLO);
    const session = await this.sessions.create({ name: title.slice(0, 100), start_date, end_date } as never, actor);
    const [section] = await this.sections.listForClass(classEntity.id);
    if (!section) throw new ConflictException('The course could not be set up');
    await this.sections.prepareCourseSection(section.id, { session_id: session.id, branch_id: branch.id, seat_limit, name: 'A' }, actor);
    const course = await this.courseRepo.save(
      this.courseRepo.create({
        organization_id: tenant.organizationId,
        title,
        branch_id: branch.id,
        class_id: classEntity.id,
        session_id: session.id,
        section_id: section.id,
        modules,
        start_date,
        end_date,
        created_by: user.id,
      }),
    );
    await this.syncModules(tenant, user, course, modules, input.teachers ?? {});
    this.audit.record({ action: AUDIT_ACTIONS.IELTS_COURSE_CREATE, organizationId: tenant.organizationId, actorId: user.id, entityType: 'ielts_course', entityId: course.id, after: { title, start_date, end_date, modules, seat_limit, branch_id: branch.id } });
    return this.get(tenant, user.id, course.id);
  }

  async update(tenant: Tenant, user: JwtPayloadInterface, id: string, input: CourseInput): Promise<CourseView> {
    await this.profiles.assertIeltsCentre(tenant);
    this.assertManager(tenant);
    const course = await this.find(tenant, id);
    const actor = { id: user.id, full_name: user.full_name };
    const before = { title: course.title, start_date: course.start_date, end_date: course.end_date, modules: course.modules, branch_id: course.branch_id };
    if (input.title !== undefined) course.title = this.title(input.title);
    if (input.start_date !== undefined || input.end_date !== undefined) {
      const dates = this.dates(input.start_date ?? course.start_date, input.end_date ?? course.end_date);
      course.start_date = dates.start_date;
      course.end_date = dates.end_date;
      await this.sessions.update(course.session_id, { start_date: dates.start_date, end_date: dates.end_date } as never, actor);
    }
    if (input.branch_id !== undefined) {
      const branch = await this.branchFor(tenant, input.branch_id);
      course.branch_id = branch.id;
      await this.sections.prepareCourseBranch(course.section_id, branch.id, actor);
    }
    if (input.seat_limit !== undefined) await this.sections.setSeatLimit(course.section_id, this.seatLimit(input.seat_limit), actor);
    const modules = input.modules !== undefined ? this.modules(input.modules) : course.modules;
    course.modules = modules;
    course.updated_at = new Date();
    await this.courseRepo.save(course);
    if (input.modules !== undefined || input.teachers !== undefined) await this.syncModules(tenant, user, course, modules, input.teachers ?? {});
    this.audit.record({ action: AUDIT_ACTIONS.IELTS_COURSE_UPDATE, organizationId: tenant.organizationId, actorId: user.id, entityType: 'ielts_course', entityId: course.id, before, after: { title: course.title, start_date: course.start_date, end_date: course.end_date, modules: course.modules, branch_id: course.branch_id } });
    return this.get(tenant, user.id, course.id);
  }

  /** Hides a course nobody is enrolled in (soft delete; its class and section stay). */
  async remove(tenant: Tenant, userId: string, id: string): Promise<void> {
    await this.profiles.assertIeltsCentre(tenant);
    this.assertManager(tenant);
    const course = await this.find(tenant, id);
    const [view] = await this.views(tenant.organizationId, [course]);
    if (view.students > 0) {
      throw new ConflictException({ message: 'Students are in this course; it can only end, not be removed', code: 'COURSE_HAS_STUDENTS' });
    }
    await this.courseRepo.update({ id: course.id }, { deleted_at: new Date(), deleted_by: userId });
    this.audit.record({ action: AUDIT_ACTIONS.IELTS_COURSE_REMOVE, organizationId: tenant.organizationId, actorId: userId, entityType: 'ielts_course', entityId: course.id, before: { title: course.title } });
  }

  // ------------------------------------------------------------------ helpers

  private async find(tenant: Tenant, id: string): Promise<IeltsCourseEntity> {
    const course = await this.courseRepo.findOne({ where: { id, organization_id: tenant.organizationId, deleted_at: IsNull() } });
    if (!course || (tenant.branchId && course.branch_id !== tenant.branchId)) throw new NotFoundException('Course not found');
    return course;
  }

  /** Module subject classes in the course's section, with the chosen teachers. Removed modules keep their subject class (history). */
  private async syncModules(tenant: Tenant, user: JwtPayloadInterface, course: IeltsCourseEntity, modules: IeltsModuleEnum[], teachers: Partial<Record<IeltsModuleEnum, string[]>>): Promise<void> {
    const actor = { id: user.id, full_name: user.full_name };
    let offerings = await this.sections.offeringsOfSection(tenant.organizationId, course.section_id);
    for (const module of modules) {
      const subject = MODULE_SUBJECTS[module];
      if (!offerings.some((o) => o.subject.name === subject.name)) {
        await this.classes.addCourseSubject(course.class_id, tenant.organizationId, subject, actor, tenant.kind === OrganizationKindEnum.SOLO);
      }
    }
    offerings = await this.sections.offeringsOfSection(tenant.organizationId, course.section_id);
    for (const module of modules) {
      const ids = teachers[module];
      if (!ids) continue;
      const offering = offerings.find((o) => o.subject.name === MODULE_SUBJECTS[module].name);
      if (offering) await this.sections.setTeachers(offering.id, { teacher_ids: ids }, actor);
    }
  }

  private async views(organizationId: string, courses: IeltsCourseEntity[]): Promise<CourseView[]> {
    if (courses.length === 0) return [];
    const today = schoolDateIn(await this.orgSettings.timeZone(organizationId));
    const sectionIds = courses.map((c) => c.section_id);
    const branchIds = [...new Set(courses.map((c) => c.branch_id).filter((b): b is string => Boolean(b)))];
    const [branches, seats, counts, teacherRows] = await Promise.all([
      branchIds.length ? this.dataSource.getRepository(BranchEntity).find({ where: { id: In(branchIds) } }) : Promise.resolve([]),
      this.dataSource.query(`SELECT id, seat_limit FROM sections WHERE id = ANY($1)`, [sectionIds]),
      this.dataSource.query(
        `SELECT section_id, count(*)::int AS n FROM enrolments WHERE section_id = ANY($1) AND status IN ('ACTIVE', 'PENDING', 'INVITED') GROUP BY section_id`,
        [sectionIds],
      ),
      this.dataSource.query(
        `SELECT o.section_id, o.id AS offering_id, s.name AS subject, u.id AS teacher_id, u.full_name
         FROM course_offerings o JOIN subjects s ON s.id = o.subject_id
         LEFT JOIN offering_teachers ot ON ot.offering_id = o.id
         LEFT JOIN users u ON u.id = ot.teacher_id
         WHERE o.section_id = ANY($1)`,
        [sectionIds],
      ),
    ]);
    const seatOf = new Map<string, number | null>(seats.map((r: { id: string; seat_limit: number | null }) => [r.id, r.seat_limit]));
    const countOf = new Map<string, number>(counts.map((r: { section_id: string; n: number }) => [r.section_id, r.n]));
    return courses.map((course) => {
      const branch = branches.find((b) => b.id === course.branch_id) ?? null;
      const modules = MODULE_ORDER.filter((m) => course.modules.includes(m));
      return {
        id: course.id,
        title: course.title,
        branch: branch ? { id: branch.id, name: branch.name, is_default: branch.is_default } : null,
        start_date: course.start_date,
        end_date: course.end_date,
        status: today < course.start_date ? 'UPCOMING' : today > course.end_date ? 'ENDED' : 'RUNNING',
        modules,
        seat_limit: seatOf.get(course.section_id) ?? null,
        students: countOf.get(course.section_id) ?? 0,
        teachers: modules.map((module) => {
          const rows = teacherRows.filter(
            (r: { section_id: string; subject: string }) => r.section_id === course.section_id && r.subject === MODULE_SUBJECTS[module].name,
          );
          return {
            module,
            offering_id: rows[0]?.offering_id ?? null,
            teachers: rows.filter((r: { teacher_id: string | null }) => r.teacher_id).map((r: { teacher_id: string; full_name: string | null }) => ({ id: r.teacher_id, full_name: r.full_name })),
          };
        }),
        class_id: course.class_id,
        session_id: course.session_id,
        section_id: course.section_id,
      } satisfies CourseView;
    });
  }

  /** Students no longer see a course once it has ended, after the organisation's grace days. */
  private async visibleToStudents(organizationId: string, views: CourseView[]): Promise<CourseView[]> {
    const days = (await this.orgSettings.get(organizationId)).ended_course_visible_days ?? 0;
    const today = schoolDateIn(await this.orgSettings.timeZone(organizationId));
    const cutoff = new Date(`${today}T00:00:00Z`);
    cutoff.setUTCDate(cutoff.getUTCDate() - days);
    const lastVisibleEnd = cutoff.toISOString().slice(0, 10);
    return views.filter((view) => view.status !== 'ENDED' || view.end_date >= lastVisibleEnd);
  }

  /** Sections a teacher teaches (module teachers or class teacher) or a student is in. */
  private async visibleSectionIds(tenant: Tenant, userId: string): Promise<string[]> {
    if (this.isStudent(tenant)) {
      const rows = await this.dataSource.query(
        `SELECT section_id FROM enrolments WHERE organization_id = $1 AND student_id = $2 AND status = 'ACTIVE'`,
        [tenant.organizationId, userId],
      );
      return rows.map((r: { section_id: string }) => r.section_id);
    }
    const rows = await this.dataSource.query(
      `SELECT o.section_id FROM course_offerings o JOIN offering_teachers ot ON ot.offering_id = o.id WHERE o.organization_id = $1 AND ot.teacher_id = $2
       UNION SELECT id FROM sections WHERE organization_id = $1 AND class_teacher_id = $2`,
      [tenant.organizationId, userId],
    );
    return rows.map((r: { section_id: string }) => r.section_id);
  }

  private isStudent(tenant: Tenant): boolean {
    return tenant.memberRole === OrganizationMemberRoleEnum.STUDENT || Boolean(tenant.viaEnrolment);
  }

  private isManager(tenant: Tenant): boolean {
    return !tenant.viaEnrolment && MANAGERS.includes(tenant.memberRole);
  }

  private assertManager(tenant: Tenant): void {
    if (!this.isManager(tenant)) {
      throw new ForbiddenException({ message: 'Only owners, admins and branch managers run courses', code: 'IELTS_COURSE_MANAGERS_ONLY' });
    }
  }

  private async branchFor(tenant: Tenant, branchId: string | null | undefined): Promise<BranchEntity> {
    // A branch manager's courses are always in their branch.
    const wanted = tenant.branchId ?? branchId ?? null;
    if (!wanted) return this.branches.defaultBranch(tenant.organizationId);
    const branch = await this.dataSource.getRepository(BranchEntity).findOne({ where: { id: wanted, organization_id: tenant.organizationId, is_active: '1' as never } });
    if (!branch) throw new BadRequestException({ message: 'Choose a branch of this organisation', code: 'BRANCH_REQUIRED' });
    return branch;
  }

  private title(raw: string | undefined): string {
    const title = raw?.trim();
    if (!title || title.length > 150) throw new BadRequestException({ message: 'Give the course a title (up to 150 characters)', code: 'IELTS_COURSE_INVALID' });
    return title;
  }

  private dates(start: string | undefined, end: string | undefined): { start_date: string; end_date: string } {
    const valid = (d?: string) => Boolean(d && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`)));
    if (!valid(start) || !valid(end) || (end as string) < (start as string)) {
      throw new BadRequestException({ message: 'Give a start date and an end date on or after it', code: 'IELTS_COURSE_INVALID' });
    }
    return { start_date: start as string, end_date: end as string };
  }

  private modules(raw: IeltsModuleEnum[] | undefined): IeltsModuleEnum[] {
    const modules = MODULE_ORDER.filter((m) => raw?.includes(m));
    if (!raw || modules.length === 0 || modules.length !== new Set(raw).size) {
      throw new BadRequestException({ message: 'Choose one or more modules', code: 'IELTS_COURSE_INVALID' });
    }
    return modules;
  }

  private seatLimit(raw: number | null | undefined): number | null {
    if (raw === null || raw === undefined) return null;
    if (!Number.isInteger(raw) || raw < 1 || raw > 1000) throw new BadRequestException({ message: 'A seat limit is 1 to 1000', code: 'IELTS_COURSE_INVALID' });
    return raw;
  }
}
