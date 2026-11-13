import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AcademicSessionsService } from 'src/academics/academic-sessions.service';
import { AcademicSessionEntity, AcademicSessionStatusEnum } from 'src/academics/entities/academic-session.entity';
import { SectionEntity } from 'src/academics/entities/section.entity';
import { SectionsService } from 'src/academics/sections.service';
import { AttendanceCounts } from 'src/attendance/attendance-report';
import { AttendanceReportsService, StudentAttendance } from 'src/attendance/attendance-reports.service';
import { Tenant } from 'src/common/tenancy/tenant-context';
import { ExamResultsReadService } from 'src/exams/exam-results-read.service';
import { OfflineExamsService } from 'src/exams/offline-exams.service';
import { HomeworkScoreFact, HomeworkScoresService } from 'src/homework/homework-scores.service';
import { OrganizationMemberRoleEnum } from 'src/organizations/enums/organization-member-role.enum';
import { OrgSettingsService, PerformanceSettings } from 'src/organizations/org-settings.service';
import { GradingScaleService } from 'src/performance/grading-scale.service';
import { Grade, GradeBand, gradeForPercentage } from 'src/performance/grading-scale.util';
import { BehaviourAverage, BehaviourService } from './behaviour.service';
import { ScoreWeightEntity } from './entities/score-weight.entity';
import { RESULTS_ERRORS } from './results-errors';
import { DEFAULT_WEIGHTS, mean, positions, round2, ScoreParts, ScoreWeights, weightedScore } from './score-calc';

const { OWNER, ADMIN, ASSISTANT, TEACHER, STUDENT } = OrganizationMemberRoleEnum;
/** Staff who see every section's scores; teachers see the sections they look after. */
const MANAGERS = [OWNER, ADMIN, ASSISTANT];
/** A subject needs this many scored items to count as a strength or weakness (PRF-06). */
const MIN_ITEMS_FOR_STRENGTH = 3;

export type AtRiskReason = 'SCORE' | 'ATTENDANCE' | 'MISSING_HOMEWORK';

export interface ScoreLine extends ScoreParts {
  score_pct: number | null;
  grade: Grade | null;
  /** How many items each part is based on. */
  counts: { exams: number; homework: number; ratings: number };
}

export interface SubjectLine extends ScoreLine {
  subject: { id: string; name: string };
}

export interface StudentScore {
  student: { id: string; full_name: string; roll_no: string | null };
  overall: ScoreLine;
  subjects: SubjectLine[];
  homework: { set: number; missing: number; late: number };
  missing_homework: number;
  at_risk: AtRiskReason[];
  /** Merit position in the section (PRF-10); null without a score. */
  position: number | null;
}

/** One exam of the period with the section's average, for the trend across exams (PRF-07). */
export interface ExamSummary {
  id: string;
  kind: 'ONLINE' | 'PAPER';
  name: string;
  date: string;
  subject_id: string | null;
  average_pct: number | null;
  taken: number;
}

export interface SectionScores {
  section: { id: string; name: string; class_id: string; class_name: string; session_id: string };
  period: { from: string; to: string; term: { id: string; name: string } | null };
  weights: ScoreWeights & { is_default: boolean };
  thresholds: PerformanceSettings['at_risk'];
  subjects: { id: string; name: string }[];
  exams: ExamSummary[];
  students: StudentScore[];
}

export interface StudentExamItem {
  id: string;
  kind: 'ONLINE' | 'PAPER';
  name: string;
  date: string;
  subject: { id: string; name: string } | null;
  marks: number | null;
  total: number;
  percent: number | null;
  is_absent: boolean;
}

export interface StudentPerformance {
  student: { id: string; full_name: string; roll_no: string | null };
  section: { id: string; name: string; class_name: string; session: { id: string; name: string; closed: boolean } };
  /** Every section the student is or was in, newest session first (history, PRF-05). */
  sections: { id: string; name: string; class_name: string; session: { id: string; name: string } }[];
  terms: { id: string; name: string }[];
  period: SectionScores['period'];
  weights: SectionScores['weights'];
  overall: ScoreLine;
  subjects: SubjectLine[];
  /** Null when the student may not see it (the organisation's show_rank setting). */
  position: number | null;
  class_size: number;
  at_risk: AtRiskReason[];
  attendance: { counts: AttendanceCounts; attendance_pct: number | null };
  homework: StudentScore['homework'] & { on_time_pct: number | null };
  exams: StudentExamItem[];
  homework_items: { id: string; title: string; subject: { id: string; name: string } | null; due_date: string; percent: number; is_missing: boolean; is_late: boolean }[];
  /** The overall score per term of the session, in order (PRF-05). */
  trend: { term: { id: string; name: string }; score_pct: number | null }[];
  /** The best and weakest subjects with at least 3 scored items (PRF-06; topics come with the syllabus, Epic 6). */
  strengths: SubjectLine[];
  weaknesses: SubjectLine[];
  /** Results only students can see (published), as on their own page. */
  published_only: boolean;
}

/** A student's page before it is fitted to who reads it (history, position, at risk). */
export type SectionPage = Omit<StudentPerformance, 'sections' | 'published_only'>;

/** An exam result as the scores count it: online or on paper. */
interface ExamFact {
  exam_id: string;
  kind: 'ONLINE' | 'PAPER';
  name: string;
  date: string;
  subject_id: string | null;
  student_id: string;
  marks: number | null;
  total: number;
  /** As counted: a missed paper exam is 0. */
  percent: number;
  is_absent: boolean;
}

interface Context {
  organizationId: string;
  section: SectionEntity;
  session: AcademicSessionEntity;
  term: { id: string; name: string } | null;
  terms: { id: string; name: string; start_date: string | null; end_date: string | null }[];
  from: string;
  to: string;
  weights: ScoreWeights & { is_default: boolean };
  settings: PerformanceSettings;
  timeZone: string;
  bands: GradeBand[];
  offerings: { id: string; subject: { id: string; name: string } }[];
}

interface Facts {
  exams: ExamFact[];
  homework: HomeworkScoreFact[];
  attendance: Map<string, StudentAttendance>;
  behaviour: BehaviourAverage[];
}

/**
 * The live scores (P7-02; spec Epic 3 "How the score is calculated"): worked out on request from
 * exams (online and on paper), homework, attendance and behaviour, so they are always up to date.
 * Nothing is stored; report cards (P7-04) freeze a copy. A section's students for a term (or the
 * whole session), with the class's weights, per subject and overall, their merit positions and
 * whether they are at risk; and one student's page with every item, the trend across terms and
 * their strongest and weakest subjects (P7-03).
 *
 * Which items count for a term: exams with that term, or without a term and held within its dates;
 * homework due, attendance and ratings within its dates. A paper exam a student missed counts as
 * 0%, as missing homework does. Attendance is the student's overall attendance (the spec counts
 * days, not subjects); a subject has no score until it has an exam, homework or rating.
 */
@Injectable()
export class ScoresService {
  constructor(
    @InjectRepository(ScoreWeightEntity)
    private readonly weightRepo: Repository<ScoreWeightEntity>,
    private readonly sections: SectionsService,
    private readonly sessions: AcademicSessionsService,
    private readonly orgSettings: OrgSettingsService,
    private readonly grading: GradingScaleService,
    private readonly offlineExams: OfflineExamsService,
    private readonly onlineExams: ExamResultsReadService,
    private readonly homework: HomeworkScoresService,
    private readonly attendance: AttendanceReportsService,
    private readonly behaviour: BehaviourService,
  ) {}

  /** A class's weights for a session, or the default. */
  async weightsFor(organizationId: string, sessionId: string, classId: string): Promise<ScoreWeights & { is_default: boolean }> {
    const row = await this.weightRepo.findOne({ where: { organization_id: organizationId, session_id: sessionId, class_id: classId } });
    return row
      ? { exams_pct: row.exams_pct, homework_pct: row.homework_pct, attendance_pct: row.attendance_pct, behaviour_pct: row.behaviour_pct, is_default: false }
      : { ...DEFAULT_WEIGHTS, is_default: true };
  }

  /**
   * The sections of a session (the default one if none is given) whose scores the caller sees,
   * with the session's terms: owners, admins and staff every section; a teacher those they look after.
   */
  async visibleSections(
    tenant: Tenant,
    userId: string,
    sessionId?: string,
  ): Promise<{ session: { id: string; name: string; closed: boolean }; terms: { id: string; name: string }[]; sections: { id: string; name: string; class_name: string }[] }> {
    this.staffOnly(tenant);
    const { session, sections } = await this.sections.listWithClasses(sessionId);
    const mine = MANAGERS.includes(tenant.memberRole) ? null : await this.sections.sectionIdsTaughtBy(tenant.organizationId, session.id, userId);
    const terms = await this.sessions.termsOf(tenant.organizationId, session.id);
    return {
      session: { id: session.id, name: session.name, closed: session.status === AcademicSessionStatusEnum.CLOSED },
      terms: terms.map((term) => ({ id: term.id, name: term.name })),
      sections: sections.filter((section) => !mine || mine.has(section.id)).map((section) => ({ id: section.id, name: section.name, class_name: section.class?.class_name ?? '' })),
    };
  }

  /** A section's scores for staff: owners, admins and staff any section; a teacher the sections they look after. */
  async section(tenant: Tenant, userId: string, sectionId: string, termId?: string): Promise<SectionScores> {
    this.staffOnly(tenant);
    const section = await this.staffSection(tenant, userId, sectionId);
    return this.compute(tenant.organizationId, section.id, termId, false);
  }

  /**
   * A section's scores, with no access check (the caller checks). `published` keeps only results
   * the students can already see (their own page, report cards).
   */
  async compute(organizationId: string, sectionId: string, termId: string | undefined, published: boolean): Promise<SectionScores> {
    const ctx = await this.context(organizationId, sectionId, termId);
    const roster = await this.sections.sectionResultsRoster(organizationId, ctx.section.id);
    const facts = await this.facts(ctx, roster.map((s) => s.student_id), published);
    const students: StudentScore[] = roster.map((student) => ({
      student: { id: student.student_id, full_name: student.full_name, roll_no: student.roll_no },
      ...this.score(ctx, facts, student.student_id),
      position: null,
    }));
    const ranked = positions(students.map((s) => ({ id: s.student.id, score: s.overall.score_pct, exams: s.overall.exams_pct })));
    for (const student of students) student.position = ranked.get(student.student.id) ?? null;

    const byExam = new Map<string, ExamFact[]>();
    for (const fact of facts.exams) byExam.set(`${fact.kind}:${fact.exam_id}`, [...(byExam.get(`${fact.kind}:${fact.exam_id}`) ?? []), fact]);
    const exams: ExamSummary[] = [...byExam.values()]
      .map((group) => {
        const taken = group.filter((f) => !f.is_absent);
        return { id: group[0].exam_id, kind: group[0].kind, name: group[0].name, date: group[0].date, subject_id: group[0].subject_id, average_pct: mean(taken.map((f) => f.percent)), taken: taken.length };
      })
      .sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));

    return {
      section: { id: ctx.section.id, name: ctx.section.name, class_id: ctx.section.class_id, class_name: ctx.section.class?.class_name ?? '', session_id: ctx.session.id },
      period: { from: ctx.from, to: ctx.to, term: ctx.term },
      weights: ctx.weights,
      thresholds: ctx.settings.at_risk,
      subjects: ctx.offerings.map((o) => o.subject),
      exams,
      students,
    };
  }

  /**
   * One student's performance page (PRF-05, PRF-06): their own (published results only; their
   * position only when the organisation shows it), or for staff who see their section. Any of the
   * student's sections, so earlier sessions stay reachable; their current one by default.
   */
  async student(tenant: Tenant, userId: string, studentId: string, sectionId?: string, termId?: string): Promise<StudentPerformance> {
    const self = tenant.memberRole === STUDENT || Boolean(tenant.viaEnrolment);
    if (self && studentId !== userId) throw new ForbiddenException({ message: 'Students see only their own results', code: RESULTS_ERRORS.NOT_ALLOWED });
    if (!self) this.staffOnly(tenant);
    const organizationId = tenant.organizationId;
    const history = await this.sections.sectionsOfStudent(organizationId, studentId);
    if (history.length === 0) throw new NotFoundException({ message: 'Student not found', code: RESULTS_ERRORS.NOT_FOUND });
    const chosen = sectionId ? history.find((s) => s.id === sectionId) : (history.find((s) => s.session?.status !== AcademicSessionStatusEnum.CLOSED) ?? history[0]);
    if (!chosen) throw new NotFoundException({ message: 'Section not found', code: RESULTS_ERRORS.NOT_FOUND });
    if (!self) await this.staffSection(tenant, userId, chosen.id);

    const { pages, show_rank } = await this.pages(organizationId, chosen.id, termId, self, [studentId]);
    const page = pages.get(studentId);
    if (!page) throw new NotFoundException({ message: 'Student not found', code: RESULTS_ERRORS.NOT_FOUND });
    return {
      ...page,
      sections: history.map((s) => ({ id: s.id, name: s.name, class_name: s.class?.class_name ?? '', session: { id: s.session?.id ?? s.session_id, name: s.session?.name ?? '' } })),
      position: !self || show_rank ? page.position : null,
      at_risk: self ? [] : page.at_risk,
      published_only: self,
    };
  }

  /**
   * Performance pages of a section's students (`only` some of them, or all), with no access check:
   * the student page and report cards (P7-04). Positions and the class size are the whole section's.
   */
  async pages(
    organizationId: string,
    sectionId: string,
    termId: string | undefined,
    published: boolean,
    only?: string[],
  ): Promise<{ pages: Map<string, SectionPage>; show_rank: boolean; scores: SectionScores }> {
    const scores = await this.compute(organizationId, sectionId, termId, published);
    const ctx = await this.context(organizationId, sectionId, termId);
    const ids = only ?? scores.students.map((s) => s.student.id);
    const facts = await this.facts(ctx, ids, published);
    const subjectOf = (id: string | null) => ctx.offerings.find((o) => o.subject.id === id)?.subject ?? null;
    const trends = new Map<string, StudentPerformance['trend']>(ids.map((id) => [id, []]));
    for (const term of ctx.terms) {
      const termCtx = await this.context(organizationId, sectionId, term.id);
      const termFacts = await this.facts(termCtx, ids, published);
      for (const id of ids) trends.get(id)!.push({ term: { id: term.id, name: term.name }, score_pct: this.score(termCtx, termFacts, id).overall.score_pct });
    }

    const pages = new Map<string, SectionPage>();
    for (const own of scores.students) {
      if (!ids.includes(own.student.id)) continue;
      const id = own.student.id;
      const ranked = own.subjects.filter((s) => s.score_pct !== null && s.counts.exams + s.counts.homework >= MIN_ITEMS_FOR_STRENGTH).sort((a, b) => b.score_pct! - a.score_pct!);
      const attendance = facts.attendance.get(id) ?? { counts: { present: 0, late: 0, absent: 0, leave: 0 }, attendance_pct: null };
      const handedIn = own.homework.set - own.homework.missing;
      pages.set(id, {
        student: own.student,
        section: {
          id: ctx.section.id,
          name: ctx.section.name,
          class_name: ctx.section.class?.class_name ?? '',
          session: { id: ctx.session.id, name: ctx.session.name, closed: ctx.session.status === AcademicSessionStatusEnum.CLOSED },
        },
        terms: ctx.terms.map((t) => ({ id: t.id, name: t.name })),
        period: scores.period,
        weights: scores.weights,
        overall: own.overall,
        subjects: own.subjects,
        position: own.position,
        class_size: scores.students.length,
        at_risk: own.at_risk,
        attendance,
        homework: { ...own.homework, on_time_pct: own.homework.set ? round2(((handedIn - own.homework.late) / own.homework.set) * 100) : null },
        exams: facts.exams
          .filter((f) => f.student_id === id)
          .map((f) => ({ id: f.exam_id, kind: f.kind, name: f.name, date: f.date, subject: subjectOf(f.subject_id), marks: f.marks, total: f.total, percent: f.is_absent ? null : f.percent, is_absent: f.is_absent }))
          .sort((a, b) => b.date.localeCompare(a.date)),
        homework_items: facts.homework
          .filter((h) => h.student_id === id)
          .map((h) => ({ id: h.homework_id, title: h.title, subject: subjectOf(h.subject_id), due_date: h.due_date, percent: h.percent, is_missing: h.is_missing, is_late: h.is_late }))
          .sort((a, b) => b.due_date.localeCompare(a.due_date)),
        trend: trends.get(id) ?? [],
        strengths: ranked.slice(0, 3),
        weaknesses: ranked.length > 3 ? ranked.slice(-3).reverse() : [],
      });
    }
    return { pages, show_rank: ctx.settings.show_rank, scores };
  }

  // ------------------------------------------------------------------ helpers

  private async context(organizationId: string, sectionId: string, termId: string | undefined): Promise<Context> {
    const [section] = await this.sections.findSectionsWithClasses(organizationId, [sectionId]);
    if (!section || !section.session) throw new NotFoundException({ message: 'Section not found', code: RESULTS_ERRORS.NOT_FOUND });
    const session = section.session;
    const terms = (await this.sessions.termsOf(organizationId, session.id)).map((t) => ({ id: t.id, name: t.name, start_date: t.start_date, end_date: t.end_date }));
    const term = termId ? (terms.find((t) => t.id === termId) ?? null) : null;
    if (termId && !term) throw new NotFoundException({ message: 'Term not found', code: RESULTS_ERRORS.NOT_FOUND });
    const [weights, settings, timeZone, scale, offerings] = await Promise.all([
      this.weightsFor(organizationId, session.id, section.class_id),
      this.orgSettings.getPerformance(organizationId),
      this.orgSettings.timeZone(organizationId),
      this.grading.getScale(organizationId),
      this.sections.offeringsOfSection(organizationId, section.id),
    ]);
    return {
      organizationId,
      section,
      session,
      term: term ? { id: term.id, name: term.name } : null,
      terms,
      from: term?.start_date ?? session.start_date,
      to: term?.end_date ?? session.end_date,
      weights,
      settings,
      timeZone,
      bands: scale.bands,
      offerings,
    };
  }

  private async facts(ctx: Context, ids: string[], published: boolean): Promise<Facts> {
    const inPeriod = (date: string) => date >= ctx.from && date <= ctx.to;
    const counts = (termId: string | null, date: string) => (ctx.term ? termId === ctx.term.id || (termId === null && inPeriod(date)) : inPeriod(date));
    const { organizationId, session, from, to, timeZone } = ctx;
    // Exams are read for the whole session, then kept by the term rule (a term's exam may fall outside its dates).
    const [paper, online, homework, attendance, behaviour] = await Promise.all([
      this.offlineExams.marksOf(organizationId, ids, session.start_date, session.end_date, published),
      this.onlineExams.resultsOf(organizationId, ids, session.start_date, session.end_date, timeZone, published),
      this.homework.scoresOf(organizationId, ids, from, to, timeZone, published),
      this.attendance.studentAttendance(organizationId, ids, from, to),
      this.behaviour.averagesOf(organizationId, ids, from, to),
    ]);
    const exams: ExamFact[] = [];
    for (const m of paper) {
      if (!counts(m.term_id, m.exam_date) || (!m.is_absent && m.percent === null)) continue;
      exams.push({ exam_id: m.exam_id, kind: 'PAPER', name: m.name, date: m.exam_date, subject_id: m.subject_id, student_id: m.student_id, marks: m.marks, total: m.total_marks, percent: m.is_absent ? 0 : m.percent!, is_absent: m.is_absent });
    }
    for (const r of online) {
      if (!counts(r.term_id, r.exam_date)) continue;
      exams.push({ exam_id: r.exam_id, kind: 'ONLINE', name: r.name, date: r.exam_date, subject_id: r.subject_id, student_id: r.student_id, marks: r.score, total: r.max_score, percent: r.percent, is_absent: false });
    }
    return { exams, homework, attendance, behaviour };
  }

  private score(ctx: Context, facts: Facts, studentId: string): Omit<StudentScore, 'student' | 'position'> {
    const items = facts.exams.filter((f) => f.student_id === studentId);
    const work = facts.homework.filter((w) => w.student_id === studentId);
    const ratings = facts.behaviour.filter((r) => r.student_id === studentId);
    const attendancePct = facts.attendance.get(studentId)?.attendance_pct ?? null;

    const line = (exams: ExamFact[], hw: HomeworkScoreFact[], rated: BehaviourAverage[], subject: boolean): ScoreLine => {
      const ratingCount = rated.reduce((sum, r) => sum + r.ratings, 0);
      const parts: ScoreParts = {
        exams_pct: mean(exams.map((e) => e.percent)),
        homework_pct: mean(hw.map((w) => w.percent)),
        attendance_pct: attendancePct,
        behaviour_pct: ratingCount ? round2((rated.reduce((sum, r) => sum + r.average * r.ratings, 0) / ratingCount / 5) * 100) : null,
      };
      // A subject with nothing of its own yet has no score (attendance alone is not a subject's score).
      const empty = subject && parts.exams_pct === null && parts.homework_pct === null && parts.behaviour_pct === null;
      const score = empty ? null : weightedScore(parts, ctx.weights);
      return { ...parts, score_pct: score, grade: gradeForPercentage(ctx.bands, score), counts: { exams: exams.length, homework: hw.length, ratings: ratingCount } };
    };

    const overall = line(items, work, ratings, false);
    const missing = work.filter((w) => w.is_missing).length;
    const atRisk: AtRiskReason[] = [];
    const limits = ctx.settings.at_risk;
    if (overall.score_pct !== null && overall.score_pct < limits.score_pct) atRisk.push('SCORE');
    if (attendancePct !== null && attendancePct < limits.attendance_pct) atRisk.push('ATTENDANCE');
    if (missing >= limits.missing_homework) atRisk.push('MISSING_HOMEWORK');
    return {
      overall,
      subjects: ctx.offerings.map((offering) => ({
        subject: offering.subject,
        ...line(
          items.filter((i) => i.subject_id === offering.subject.id),
          work.filter((w) => w.subject_id === offering.subject.id),
          ratings.filter((r) => r.offering_id === offering.id),
          true,
        ),
      })),
      homework: { set: work.length, missing, late: work.filter((w) => w.is_late && !w.is_missing).length },
      missing_homework: missing,
      at_risk: atRisk,
    };
  }

  staffOnly(tenant: Tenant): void {
    if (tenant.viaEnrolment || ![...MANAGERS, TEACHER].includes(tenant.memberRole)) {
      throw new ForbiddenException({ message: 'Only staff of this workspace see scores', code: RESULTS_ERRORS.NOT_ALLOWED });
    }
  }

  /** A section staff may see: any for owners, admins and staff; a teacher the ones they look after (404 otherwise). */
  async staffSection(tenant: Tenant, userId: string, sectionId: string): Promise<SectionEntity> {
    const [section] = await this.sections.findSectionsWithClasses(tenant.organizationId, [sectionId]);
    if (!section || !section.session) throw new NotFoundException({ message: 'Section not found', code: RESULTS_ERRORS.NOT_FOUND });
    if (!MANAGERS.includes(tenant.memberRole) && !(await this.sections.sectionIdsTaughtBy(tenant.organizationId, section.session_id, userId)).has(section.id)) {
      throw new NotFoundException({ message: 'Section not found', code: RESULTS_ERRORS.NOT_FOUND });
    }
    return section;
  }
}
