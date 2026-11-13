import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import { AcademicSessionStatusEnum } from 'src/academics/entities/academic-session.entity';
import { CourseOfferingEntity } from 'src/academics/entities/course-offering.entity';
import { TermEntity } from 'src/academics/entities/term.entity';
import { OfferingRosterService, RosterStudent } from 'src/academics/offering-roster.service';
import { SectionsService } from 'src/academics/sections.service';
import { AUDIT_ACTIONS } from 'src/audit/audit-actions';
import { AuditService } from 'src/audit/audit.service';
import { Tenant } from 'src/common/tenancy/tenant-context';
import { OrganizationMemberRoleEnum } from 'src/organizations/enums/organization-member-role.enum';
import { Grade, gradeForPercentage } from 'src/performance/grading-scale.util';
import { GradingScaleService } from 'src/performance/grading-scale.service';
import { CreateOfflineExamDto, OfflineExamPartDto, OfflineMarkRowDto, UpdateOfflineExamDto } from './dto/offline-exam.dto';
import { OfflineExamMarkEntity } from './entities/offline-exam-mark.entity';
import { OfflineExamEntity, OfflineExamPart } from './entities/offline-exam.entity';
import { OFFLINE_EXAM_ERRORS } from './offline-exam-errors';

const { OWNER, ADMIN, ASSISTANT, TEACHER } = OrganizationMemberRoleEnum;
/** Staff who manage every paper exam of the workspace; teachers those of subject classes they teach. */
const MANAGERS = [OWNER, ADMIN, ASSISTANT];

type Actor = { id: string; full_name?: string | null };

export interface OfflineExamView {
  id: string;
  name: string;
  exam_date: string;
  total_marks: number;
  parts: OfflineExamPart[] | null;
  session_id: string;
  term: { id: string; name: string } | null;
  offering: { id: string; subject: { id: string; name: string }; section: { id: string; name: string; class_name: string | null } };
  published_at: Date | null;
  /** Students with marks or marked absent, out of everyone taking the subject class. */
  counts: { students: number; entered: number };
  /** The caller may change it (staff of an open session). */
  can_edit: boolean;
}

export interface OfflineMarkRow {
  student: { id: string; full_name: string; roll_no: string | null };
  marks: number | null;
  part_marks: Record<string, number> | null;
  is_absent: boolean;
  /** marks ÷ total, 0–100, two decimals; null without marks. */
  percent: number | null;
  grade: Grade | null;
}

export interface OfflineMarksGrid {
  exam: OfflineExamView;
  rows: OfflineMarkRow[];
}

/** A subject class the caller may add paper exams to, with its session's terms. */
export interface OfflineSubjectClass {
  offering_id: string;
  session_id: string;
  /** "Class 6 A" */
  section_label: string;
  subject: { id: string; name: string };
  terms: { id: string; name: string; start_date: string | null; end_date: string | null }[];
}

/** A student's published paper-exam result (their own view). */
export interface MyOfflineResult {
  exam: Pick<OfflineExamView, 'id' | 'name' | 'exam_date' | 'total_marks' | 'parts' | 'term'> & { subject: { id: string; name: string } };
  marks: number | null;
  part_marks: Record<string, number> | null;
  is_absent: boolean;
  percent: number | null;
  grade: Grade | null;
}

/** A paper-exam mark for the performance read (Epic 3): the exam, its subject and the student's %. */
export interface OfflineMarkFact {
  exam_id: string;
  name: string;
  exam_date: string;
  term_id: string | null;
  offering_id: string;
  subject_id: string;
  student_id: string;
  is_absent: boolean;
  /** 0–100, two decimals; null when absent or not entered. */
  percent: number | null;
  marks: number | null;
  total_marks: number;
}

const num = (value: string | null | undefined) => (value === null || value === undefined ? null : Number(value));
const pct = (marks: number | null, total: number) => (marks === null || !total ? null : Math.round((marks / total) * 10_000) / 100);
const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * Exams taken on paper (P7-01, PRF-03): a teacher of the subject class (or the owner, an admin or
 * staff) creates one with its date, total and optional parts, enters every student's marks in a
 * grid (or marks them absent; a CSV is filled in on the web and sent as the same rows), and
 * publishes them for the students. Every change of marks is kept in the audit log (design §8.11).
 */
@Injectable()
export class OfflineExamsService {
  constructor(
    @InjectRepository(OfflineExamEntity)
    private readonly examRepo: Repository<OfflineExamEntity>,
    @InjectRepository(OfflineExamMarkEntity)
    private readonly markRepo: Repository<OfflineExamMarkEntity>,
    private readonly dataSource: DataSource,
    private readonly sections: SectionsService,
    private readonly roster: OfferingRosterService,
    private readonly grading: GradingScaleService,
    private readonly audit: AuditService,
  ) {}

  /** Paper exams the caller manages: every one for owners, admins and staff; a teacher's subject classes. */
  async list(tenant: Tenant, userId: string, query: { offering_id?: string; session_id?: string }): Promise<OfflineExamView[]> {
    this.assertStaff(tenant);
    const where: Record<string, unknown> = { organization_id: tenant.organizationId, removed_at: IsNull() };
    if (query.offering_id) where.offering_id = query.offering_id;
    if (query.session_id) where.session_id = query.session_id;
    if (!MANAGERS.includes(tenant.memberRole)) {
      const taught = await this.sections.offeringIdsTaughtBy(tenant.organizationId, userId);
      if (query.offering_id && !taught.includes(query.offering_id)) return [];
      if (!query.offering_id) {
        if (taught.length === 0) return [];
        where.offering_id = In(taught);
      }
    }
    const exams = await this.examRepo.find({ where, order: { exam_date: 'DESC', created_at: 'DESC' }, take: 300 });
    return this.views(tenant, userId, exams);
  }

  /**
   * The subject classes the caller may add paper exams to, in open sessions: every one for owners,
   * admins and staff, those they teach for a teacher; with the session's terms. Sorted naturally.
   */
  async subjectClasses(tenant: Tenant, userId: string): Promise<OfflineSubjectClass[]> {
    this.assertStaff(tenant);
    const organizationId = tenant.organizationId;
    const ids = MANAGERS.includes(tenant.memberRole) ? await this.sections.openOfferingIds(organizationId) : await this.sections.offeringIdsTaughtBy(organizationId, userId);
    const found = await this.sections.offeringsWithTeachers(organizationId, ids);
    const sessionIds = [...new Set(found.map(({ offering }) => offering.session_id))];
    const terms = sessionIds.length
      ? await this.dataSource.getRepository(TermEntity).find({ where: { organization_id: organizationId, session_id: In(sessionIds) }, order: { sort_order: 'ASC', start_date: 'ASC' } })
      : [];
    return found
      .map(({ offering }) => ({
        offering_id: offering.id,
        session_id: offering.session_id,
        section_label: `${offering.section?.class?.class_name ?? ''} ${offering.section?.name ?? ''}`.trim(),
        subject: { id: offering.subject_id, name: offering.subject?.name ?? '' },
        terms: terms
          .filter((term) => term.session_id === offering.session_id)
          .map((term) => ({ id: term.id, name: term.name, start_date: term.start_date, end_date: term.end_date })),
      }))
      .sort((a, b) => a.section_label.localeCompare(b.section_label, 'en', { numeric: true }) || a.subject.name.localeCompare(b.subject.name));
  }

  async create(tenant: Tenant, actor: Actor, dto: CreateOfflineExamDto): Promise<OfflineExamView> {
    const offering = await this.editableOffering(tenant, actor.id, dto.offering_id);
    const parts = this.checkParts(dto.parts ?? null, dto.total_marks);
    const termId = await this.checkTerm(tenant, offering.session_id, dto.term_id ?? null);
    const saved = await this.examRepo.save(
      this.examRepo.create({
        organization_id: tenant.organizationId,
        session_id: offering.session_id,
        term_id: termId,
        offering_id: offering.id,
        name: dto.name.trim(),
        exam_date: dto.exam_date,
        total_marks: String(dto.total_marks),
        parts,
        created_by: actor.id,
      }),
    );
    this.audit.record({
      action: AUDIT_ACTIONS.OFFLINE_EXAM_CREATE,
      organizationId: tenant.organizationId,
      actorId: actor.id,
      entityType: 'offline_exam',
      entityId: saved.id,
      after: examState(saved),
    });
    return (await this.views(tenant, actor.id, [saved]))[0];
  }

  async update(tenant: Tenant, actor: Actor, id: string, dto: UpdateOfflineExamDto): Promise<OfflineExamView> {
    const exam = await this.editableExam(tenant, actor.id, id);
    const before = examState(exam);
    const total = dto.total_marks ?? Number(exam.total_marks);
    const parts = dto.parts !== undefined ? this.checkParts(dto.parts, total) : exam.parts ? this.checkParts(exam.parts, total) : null;
    if (dto.total_marks !== undefined || dto.parts !== undefined) {
      // Marks already entered must still fit the new total and parts.
      const marks = await this.markRepo.find({ where: { offline_exam_id: exam.id } });
      for (const mark of marks) {
        const tooHigh = num(mark.marks) !== null && (num(mark.marks) as number) > total;
        const partTooHigh = parts && mark.part_marks && parts.some((part) => (mark.part_marks?.[part.name] ?? 0) > part.marks);
        if (tooHigh || partTooHigh) {
          throw new ConflictException({ message: 'Some marks are above the new total', code: OFFLINE_EXAM_ERRORS.TOTAL_BELOW_MARKS });
        }
      }
    }
    if (dto.name !== undefined) exam.name = dto.name.trim();
    if (dto.exam_date !== undefined) exam.exam_date = dto.exam_date;
    exam.total_marks = String(total);
    exam.parts = parts;
    if (dto.term_id !== undefined) exam.term_id = await this.checkTerm(tenant, exam.session_id, dto.term_id);
    exam.updated_by = actor.id;
    exam.updated_at = new Date();
    await this.examRepo.save(exam);
    this.audit.record({
      action: AUDIT_ACTIONS.OFFLINE_EXAM_UPDATE,
      organizationId: tenant.organizationId,
      actorId: actor.id,
      entityType: 'offline_exam',
      entityId: exam.id,
      before,
      after: examState(exam),
    });
    return (await this.views(tenant, actor.id, [exam]))[0];
  }

  /** Removes it from every list (kept, with who and when); its marks stop counting. */
  async remove(tenant: Tenant, actor: Actor, id: string): Promise<void> {
    const exam = await this.editableExam(tenant, actor.id, id);
    await this.examRepo.update({ id: exam.id, organization_id: tenant.organizationId }, { removed_at: new Date(), removed_by: actor.id });
    this.audit.record({
      action: AUDIT_ACTIONS.OFFLINE_EXAM_REMOVE,
      organizationId: tenant.organizationId,
      actorId: actor.id,
      entityType: 'offline_exam',
      entityId: exam.id,
      before: examState(exam),
    });
  }

  /** Everyone taking the subject class (and anyone with marks already) with their marks. */
  async grid(tenant: Tenant, userId: string, id: string): Promise<OfflineMarksGrid> {
    const exam = await this.staffExam(tenant, userId, id);
    const offering = await this.sections.findOffering(exam.offering_id);
    const [students, marks] = await Promise.all([this.roster.students(offering), this.markRepo.find({ where: { offline_exam_id: exam.id } })]);
    const people = new Map<string, OfflineMarkRow['student']>(students.map((s) => [s.student_id, { id: s.student_id, full_name: s.full_name, roll_no: s.roll_no }]));
    const extra = marks.map((m) => m.student_id).filter((sid) => !people.has(sid));
    if (extra.length) {
      const users: { id: string; full_name: string }[] = await this.dataSource.query(`SELECT id, full_name FROM users WHERE id = ANY($1)`, [extra]);
      for (const u of users) people.set(u.id, { id: u.id, full_name: u.full_name, roll_no: null });
    }
    const total = Number(exam.total_marks);
    const scale = await this.grading.getScale(tenant.organizationId);
    const rows = [...people.values()].map((student) => {
      const mark = marks.find((m) => m.student_id === student.id);
      const value = mark && !mark.is_absent ? num(mark.marks) : null;
      const percent = pct(value, total);
      return {
        student,
        marks: value,
        part_marks: mark?.part_marks ?? null,
        is_absent: mark?.is_absent ?? false,
        percent,
        grade: percent === null ? null : gradeForPercentage(scale.bands, percent),
      };
    });
    return { exam: (await this.views(tenant, userId, [exam]))[0], rows };
  }

  /** Saves marks for one or many students. With parts, the total is the sum of the parts. */
  async saveMarks(tenant: Tenant, actor: Actor, id: string, rows: OfflineMarkRowDto[]): Promise<OfflineMarksGrid> {
    const exam = await this.editableExam(tenant, actor.id, id);
    const offering = await this.sections.findOffering(exam.offering_id);
    const taking = new Set((await this.roster.students(offering)).map((s: RosterStudent) => s.student_id));
    const total = Number(exam.total_marks);
    const parts = exam.parts ?? [];
    const invalid = (message: string, details?: unknown) => new BadRequestException({ message, code: OFFLINE_EXAM_ERRORS.MARKS_INVALID, details });
    const wanted: { studentId: string; marks: number | null; partMarks: Record<string, number> | null; absent: boolean }[] = [];
    for (const [index, row] of rows.entries()) {
      if (!taking.has(row.student_id)) {
        throw new BadRequestException({ message: 'The student does not take this subject class', code: OFFLINE_EXAM_ERRORS.STUDENT_NOT_IN_CLASS, details: { index } });
      }
      if (row.is_absent) {
        wanted.push({ studentId: row.student_id, marks: null, partMarks: null, absent: true });
        continue;
      }
      if (parts.length && row.part_marks) {
        const partMarks: Record<string, number> = {};
        for (const part of parts) {
          const value = row.part_marks[part.name];
          if (value === undefined || value === null) continue;
          if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > part.marks) throw invalid(`${part.name}: 0 to ${part.marks}`, { index, part: part.name, max: part.marks });
          partMarks[part.name] = round2(value);
        }
        const entered = Object.keys(partMarks).length;
        if (entered > 0 && entered < parts.length) throw invalid('Enter every part, or none', { index });
        const sum = entered ? round2(Object.values(partMarks).reduce((a, b) => a + b, 0)) : null;
        wanted.push({ studentId: row.student_id, marks: sum, partMarks: entered ? partMarks : null, absent: false });
        continue;
      }
      if (parts.length && row.marks !== undefined && row.marks !== null) throw invalid('This exam has parts: enter marks per part', { index });
      const marks = row.marks ?? null;
      if (marks !== null && (marks < 0 || marks > total)) throw invalid(`0 to ${total}`, { index, max: total });
      wanted.push({ studentId: row.student_id, marks: marks === null ? null : round2(marks), partMarks: null, absent: false });
    }

    const now = new Date();
    const changes: { studentId: string; before: MarkState | null; after: MarkState }[] = [];
    await this.dataSource.transaction(async (manager) => {
      for (const row of wanted) {
        const existing = await manager.findOne(OfflineExamMarkEntity, { where: { offline_exam_id: exam.id, student_id: row.studentId } });
        const before = existing ? markState(existing) : null;
        const mark = existing ?? manager.create(OfflineExamMarkEntity, { organization_id: tenant.organizationId, offline_exam_id: exam.id, student_id: row.studentId });
        mark.marks = row.marks === null ? null : String(row.marks);
        mark.part_marks = row.partMarks;
        mark.is_absent = row.absent;
        const after = markState(mark);
        if (JSON.stringify(before) === JSON.stringify(after)) continue;
        mark.entered_by = actor.id;
        mark.entered_at = now;
        await manager.save(mark);
        changes.push({ studentId: row.studentId, before, after });
      }
    });
    if (changes.length) {
      this.audit.recordMany(
        changes.map((change) => ({
          action: AUDIT_ACTIONS.OFFLINE_EXAM_MARKS,
          organizationId: tenant.organizationId,
          actorId: actor.id,
          entityType: 'offline_exam',
          entityId: exam.id,
          before: change.before ? { student_id: change.studentId, ...change.before } : null,
          after: { student_id: change.studentId, ...change.after },
        })),
      );
    }
    return this.grid(tenant, actor.id, exam.id);
  }

  /** Students see their marks from now on. */
  async publish(tenant: Tenant, actor: Actor, id: string): Promise<OfflineExamView> {
    const exam = await this.editableExam(tenant, actor.id, id);
    if (!exam.published_at) {
      exam.published_at = new Date();
      await this.examRepo.update({ id: exam.id, organization_id: tenant.organizationId }, { published_at: exam.published_at });
      this.audit.record({
        action: AUDIT_ACTIONS.OFFLINE_EXAM_PUBLISH,
        organizationId: tenant.organizationId,
        actorId: actor.id,
        entityType: 'offline_exam',
        entityId: exam.id,
        after: { published_at: exam.published_at },
      });
    }
    return (await this.views(tenant, actor.id, [exam]))[0];
  }

  /** The student's published paper-exam results in this workspace, newest first. */
  async mine(tenant: Tenant, userId: string): Promise<MyOfflineResult[]> {
    const rows = await this.markRepo
      .createQueryBuilder('m')
      .innerJoinAndSelect('m.exam', 'e')
      .leftJoinAndSelect('e.term', 'term')
      .leftJoinAndSelect('e.offering', 'o')
      .leftJoinAndSelect('o.subject', 'subject')
      .where('m.organization_id = :org AND m.student_id = :userId', { org: tenant.organizationId, userId })
      .andWhere('e.removed_at IS NULL AND e.published_at IS NOT NULL')
      .orderBy('e.exam_date', 'DESC')
      .getMany();
    const scale = await this.grading.getScale(tenant.organizationId);
    return rows.map((m) => {
      const exam = m.exam as OfflineExamEntity;
      const total = Number(exam.total_marks);
      const value = m.is_absent ? null : num(m.marks);
      const percent = pct(value, total);
      return {
        exam: {
          id: exam.id,
          name: exam.name,
          exam_date: exam.exam_date,
          total_marks: total,
          parts: exam.parts,
          term: exam.term ? { id: exam.term.id, name: exam.term.name } : null,
          subject: { id: exam.offering?.subject?.id ?? '', name: exam.offering?.subject?.name ?? '' },
        },
        marks: value,
        part_marks: m.part_marks,
        is_absent: m.is_absent,
        percent,
        grade: percent === null ? null : gradeForPercentage(scale.bands, percent),
      };
    });
  }

  /**
   * Paper-exam marks of these students between two school dates, for the performance read
   * (Epic 3). Removed exams are left out; `published` limits it to published exams (the student's
   * own view). No access check: the caller checks.
   */
  async marksOf(organizationId: string, studentIds: string[], from: string, to: string, published = false): Promise<OfflineMarkFact[]> {
    if (studentIds.length === 0) return [];
    const rows: {
      exam_id: string; name: string; exam_date: string; term_id: string | null; offering_id: string; subject_id: string;
      student_id: string; is_absent: boolean; marks: string | null; total_marks: string;
    }[] = await this.dataSource.query(
      `SELECT e.id AS exam_id, e.name, to_char(e.exam_date, 'YYYY-MM-DD') AS exam_date, e.term_id, e.offering_id, o.subject_id,
              m.student_id, m.is_absent, m.marks, e.total_marks
         FROM offline_exam_marks m
         JOIN offline_exams e ON e.id = m.offline_exam_id
         JOIN course_offerings o ON o.id = e.offering_id
        WHERE m.organization_id = $1 AND m.student_id = ANY($2) AND e.removed_at IS NULL
          AND e.exam_date BETWEEN $3 AND $4 ${published ? 'AND e.published_at IS NOT NULL' : ''}`,
      [organizationId, studentIds, from, to],
    );
    return rows.map((row) => {
      const total = Number(row.total_marks);
      const marks = row.is_absent ? null : num(row.marks);
      return { ...row, marks, total_marks: total, percent: pct(marks, total) };
    });
  }

  // ------------------------------------------------------------------ helpers

  private async views(tenant: Tenant, userId: string, exams: OfflineExamEntity[]): Promise<OfflineExamView[]> {
    if (exams.length === 0) return [];
    const offerings = new Map(
      (await this.sections.offeringsWithTeachers(tenant.organizationId, exams.map((e) => e.offering_id))).map(({ offering, teacherIds }) => [offering.id, { offering, teacherIds }]),
    );
    const termIds = [...new Set(exams.map((e) => e.term_id).filter((t): t is string => Boolean(t)))];
    const terms = termIds.length ? await this.dataSource.getRepository(TermEntity).find({ where: { id: In(termIds), organization_id: tenant.organizationId } }) : [];
    const counts: { offline_exam_id: string; entered: number }[] = await this.dataSource.query(
      `SELECT offline_exam_id, count(*) FILTER (WHERE is_absent OR marks IS NOT NULL)::int AS entered
         FROM offline_exam_marks WHERE offline_exam_id = ANY($1) GROUP BY 1`,
      [exams.map((e) => e.id)],
    );
    const manager = MANAGERS.includes(tenant.memberRole);
    const views: OfflineExamView[] = [];
    for (const exam of exams) {
      const found = offerings.get(exam.offering_id);
      const offering = found?.offering;
      const students = offering ? (await this.roster.students(offering)).length : 0;
      const open = offering?.session?.status !== AcademicSessionStatusEnum.CLOSED;
      const term = terms.find((t) => t.id === exam.term_id);
      views.push({
        id: exam.id,
        name: exam.name,
        exam_date: exam.exam_date,
        total_marks: Number(exam.total_marks),
        parts: exam.parts,
        session_id: exam.session_id,
        term: term ? { id: term.id, name: term.name } : null,
        offering: {
          id: exam.offering_id,
          subject: { id: offering?.subject?.id ?? '', name: offering?.subject?.name ?? '' },
          section: { id: offering?.section?.id ?? '', name: offering?.section?.name ?? '', class_name: offering?.section?.class?.class_name ?? null },
        },
        published_at: exam.published_at,
        counts: { students, entered: counts.find((c) => c.offline_exam_id === exam.id)?.entered ?? 0 },
        can_edit: open && (manager || Boolean(found?.teacherIds.includes(userId))),
      });
    }
    return views;
  }

  private checkParts(parts: OfflineExamPartDto[] | OfflineExamPart[] | null, total: number): OfflineExamPart[] | null {
    if (!parts || parts.length === 0) return null;
    const names = parts.map((p) => p.name.trim());
    const sum = round2(parts.reduce((acc, p) => acc + Number(p.marks), 0));
    if (names.some((n) => !n) || new Set(names.map((n) => n.toLowerCase())).size !== names.length || sum !== round2(total)) {
      throw new BadRequestException({ message: 'Parts need distinct names and must add up to the total marks', code: OFFLINE_EXAM_ERRORS.PARTS_INVALID, details: { sum, total } });
    }
    return parts.map((p, i) => ({ name: names[i], marks: round2(Number(p.marks)) }));
  }

  private async checkTerm(tenant: Tenant, sessionId: string, termId: string | null): Promise<string | null> {
    if (!termId) return null;
    const term = await this.dataSource.getRepository(TermEntity).findOne({ where: { id: termId, organization_id: tenant.organizationId } });
    if (!term || term.session_id !== sessionId) {
      throw new BadRequestException({ message: 'Choose a term of the same session', code: OFFLINE_EXAM_ERRORS.TERM_INVALID });
    }
    return term.id;
  }

  /** A subject class the caller may add paper exams to (open session; taught by a teacher). */
  private async editableOffering(tenant: Tenant, userId: string, offeringId: string): Promise<CourseOfferingEntity> {
    this.assertStaff(tenant);
    const [found] = await this.sections.offeringsWithTeachers(tenant.organizationId, [offeringId]);
    if (!found) throw new NotFoundException({ message: 'Subject class not found', code: OFFLINE_EXAM_ERRORS.NOT_FOUND });
    if (!MANAGERS.includes(tenant.memberRole) && !found.teacherIds.includes(userId)) this.notAllowed();
    if (found.offering.session?.status === AcademicSessionStatusEnum.CLOSED) {
      throw new ConflictException({ message: 'The session is closed', code: OFFLINE_EXAM_ERRORS.SESSION_CLOSED });
    }
    return found.offering;
  }

  /** A paper exam the caller may see as staff (404 for anyone else, so ids are not probed). */
  private async staffExam(tenant: Tenant, userId: string, id: string): Promise<OfflineExamEntity> {
    this.assertStaff(tenant);
    const exam = await this.examRepo.findOne({ where: { id, organization_id: tenant.organizationId, removed_at: IsNull() } });
    if (!exam) throw new NotFoundException({ message: 'Paper exam not found', code: OFFLINE_EXAM_ERRORS.NOT_FOUND });
    if (!MANAGERS.includes(tenant.memberRole)) {
      // The subject class's own teachers, in any session (a closed one stays readable).
      const [found] = await this.sections.offeringsWithTeachers(tenant.organizationId, [exam.offering_id]);
      if (!found?.teacherIds.includes(userId)) throw new NotFoundException({ message: 'Paper exam not found', code: OFFLINE_EXAM_ERRORS.NOT_FOUND });
    }
    return exam;
  }

  private async editableExam(tenant: Tenant, userId: string, id: string): Promise<OfflineExamEntity> {
    const exam = await this.staffExam(tenant, userId, id);
    await this.editableOffering(tenant, userId, exam.offering_id);
    return exam;
  }

  private assertStaff(tenant: Tenant): void {
    if (tenant.viaEnrolment || ![...MANAGERS, TEACHER].includes(tenant.memberRole)) this.notAllowed();
  }

  private notAllowed(): never {
    throw new ForbiddenException({ message: 'Only staff of this workspace manage paper exams', code: OFFLINE_EXAM_ERRORS.NOT_ALLOWED });
  }
}

type MarkState = { marks: string | null; part_marks: Record<string, number> | null; is_absent: boolean };
const markState = (mark: OfflineExamMarkEntity): MarkState => ({ marks: mark.marks === null ? null : String(Number(mark.marks)), part_marks: mark.part_marks, is_absent: mark.is_absent });
const examState = (exam: OfflineExamEntity) => ({
  name: exam.name,
  exam_date: exam.exam_date,
  total_marks: Number(exam.total_marks),
  parts: exam.parts,
  term_id: exam.term_id,
  offering_id: exam.offering_id,
});
