import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AcademicSessionsService } from 'src/academics/academic-sessions.service';
import { SectionsService } from 'src/academics/sections.service';
import { AttendanceReportsService } from 'src/attendance/attendance-reports.service';
import { Tenant } from 'src/common/tenancy/tenant-context';
import { ExamResultsReadService } from 'src/exams/exam-results-read.service';
import { OfflineExamsService } from 'src/exams/offline-exams.service';
import { HomeworkScoresService } from 'src/homework/homework-scores.service';
import { OrganizationMemberRoleEnum } from 'src/organizations/enums/organization-member-role.enum';
import { OrgSettingsService, PerformanceSettings } from 'src/organizations/org-settings.service';
import { GradingScaleService } from 'src/performance/grading-scale.service';
import { Grade, gradeForPercentage } from 'src/performance/grading-scale.util';
import { BehaviourService } from './behaviour.service';
import { ScoreWeightEntity } from './entities/score-weight.entity';
import { RESULTS_ERRORS } from './results-errors';
import { DEFAULT_WEIGHTS, mean, positions, round2, ScoreParts, ScoreWeights, weightedScore } from './score-calc';

const { OWNER, ADMIN, ASSISTANT, TEACHER } = OrganizationMemberRoleEnum;
/** Staff who see every section's scores; teachers see the sections they look after. */
const MANAGERS = [OWNER, ADMIN, ASSISTANT];

export type AtRiskReason = 'SCORE' | 'ATTENDANCE' | 'MISSING_HOMEWORK';

export interface ScoreLine extends ScoreParts {
  score_pct: number | null;
  grade: Grade | null;
  /** How many items each part is based on. */
  counts: { exams: number; homework: number; ratings: number };
}

export interface StudentScore {
  student: { id: string; full_name: string; roll_no: string | null };
  overall: ScoreLine;
  subjects: (ScoreLine & { subject: { id: string; name: string } })[];
  missing_homework: number;
  at_risk: AtRiskReason[];
  /** Merit position in the section (PRF-10); null without a score. */
  position: number | null;
}

export interface SectionScores {
  section: { id: string; name: string; class_id: string; class_name: string; session_id: string };
  period: { from: string; to: string; term: { id: string; name: string } | null };
  weights: ScoreWeights & { is_default: boolean };
  thresholds: PerformanceSettings['at_risk'];
  students: StudentScore[];
}

/** An exam result as the scores count it: online or on paper, as a percentage. */
interface ExamItem {
  subject_id: string | null;
  percent: number;
}

/**
 * The live scores (P7-02; spec Epic 3 "How the score is calculated"): worked out on request from
 * exams (online and on paper), homework, attendance and behaviour, so they are always up to date.
 * Nothing is stored; report cards (P7-04) freeze a copy. A section's students for a term (or the
 * whole session), with the class's weights, per subject and overall, their merit positions and
 * whether they are at risk.
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

  /** A section's scores for staff: owners, admins and staff any section; a teacher the sections they look after. */
  async section(tenant: Tenant, userId: string, sectionId: string, termId?: string): Promise<SectionScores> {
    if (tenant.viaEnrolment || ![...MANAGERS, TEACHER].includes(tenant.memberRole)) {
      throw new ForbiddenException({ message: 'Only staff of this workspace see scores', code: RESULTS_ERRORS.NOT_ALLOWED });
    }
    const [section] = await this.sections.findSectionsWithClasses(tenant.organizationId, [sectionId]);
    if (!section || !section.session) throw new NotFoundException({ message: 'Section not found', code: RESULTS_ERRORS.NOT_FOUND });
    if (!MANAGERS.includes(tenant.memberRole) && !(await this.sections.sectionIdsTaughtBy(tenant.organizationId, section.session_id, userId)).has(section.id)) {
      throw new NotFoundException({ message: 'Section not found', code: RESULTS_ERRORS.NOT_FOUND });
    }
    return this.compute(tenant.organizationId, section.id, termId, false);
  }

  /**
   * A section's scores, with no access check (the caller checks). `published` keeps only results
   * the students can already see (their own page, report cards).
   */
  async compute(organizationId: string, sectionId: string, termId: string | undefined, published: boolean): Promise<SectionScores> {
    const [section] = await this.sections.findSectionsWithClasses(organizationId, [sectionId]);
    if (!section || !section.session) throw new NotFoundException({ message: 'Section not found', code: RESULTS_ERRORS.NOT_FOUND });
    const session = section.session;
    let term: { id: string; name: string; start_date: string | null; end_date: string | null } | null = null;
    if (termId) {
      term = (await this.sessions.termsOf(organizationId, session.id)).find((t) => t.id === termId) ?? null;
      if (!term) throw new NotFoundException({ message: 'Term not found', code: RESULTS_ERRORS.NOT_FOUND });
    }
    const from = term?.start_date ?? session.start_date;
    const to = term?.end_date ?? session.end_date;
    const inPeriod = (date: string) => date >= from && date <= to;
    const counts = (item: { term_id: string | null; date: string }) => (term ? item.term_id === term.id || (item.term_id === null && inPeriod(item.date)) : inPeriod(item.date));

    const roster = (await this.sections.activeStudentsOfSections(organizationId, [section.id])).get(section.id) ?? [];
    const ids = roster.map((s) => s.student_id);
    const [weights, settings, timeZone, scale, offerings] = await Promise.all([
      this.weightsFor(organizationId, session.id, section.class_id),
      this.orgSettings.getPerformance(organizationId),
      this.orgSettings.timeZone(organizationId),
      this.grading.getScale(organizationId),
      this.sections.offeringsOfSection(organizationId, section.id),
    ]);
    // Exams are read for the whole session, then kept by the term rule (a term's exam may fall outside its dates).
    const [paper, online, homework, attendance, behaviour] = await Promise.all([
      this.offlineExams.marksOf(organizationId, ids, session.start_date, session.end_date, published),
      this.onlineExams.resultsOf(organizationId, ids, session.start_date, session.end_date, timeZone, published),
      this.homework.scoresOf(organizationId, ids, from, to, timeZone, published),
      this.attendance.studentAttendance(organizationId, ids, from, to),
      this.behaviour.averagesOf(organizationId, ids, from, to),
    ]);

    const exams = new Map<string, ExamItem[]>(ids.map((id) => [id, []]));
    for (const mark of paper) {
      if (!counts({ term_id: mark.term_id, date: mark.exam_date })) continue;
      if (mark.is_absent) exams.get(mark.student_id)?.push({ subject_id: mark.subject_id, percent: 0 });
      else if (mark.percent !== null) exams.get(mark.student_id)?.push({ subject_id: mark.subject_id, percent: mark.percent });
    }
    for (const result of online) {
      if (counts({ term_id: result.term_id, date: result.exam_date })) exams.get(result.student_id)?.push({ subject_id: result.subject_id, percent: result.percent });
    }

    const line = (items: ExamItem[], work: typeof homework, ratings: typeof behaviour, attendancePct: number | null, subject: boolean): ScoreLine => {
      const ratingCount = ratings.reduce((sum, r) => sum + r.ratings, 0);
      const parts: ScoreParts = {
        exams_pct: mean(items.map((i) => i.percent)),
        homework_pct: mean(work.map((w) => w.percent)),
        attendance_pct: attendancePct,
        behaviour_pct: ratingCount ? round2((ratings.reduce((sum, r) => sum + r.average * r.ratings, 0) / ratingCount / 5) * 100) : null,
      };
      // A subject with nothing of its own yet has no score (attendance alone is not a subject's score).
      const empty = subject && parts.exams_pct === null && parts.homework_pct === null && parts.behaviour_pct === null;
      const score = empty ? null : weightedScore(parts, weights);
      return { ...parts, score_pct: score, grade: gradeForPercentage(scale.bands, score), counts: { exams: items.length, homework: work.length, ratings: ratingCount } };
    };

    const students: StudentScore[] = roster.map((student) => {
      const items = exams.get(student.student_id) ?? [];
      const work = homework.filter((w) => w.student_id === student.student_id);
      const ratings = behaviour.filter((r) => r.student_id === student.student_id);
      const attendancePct = attendance.get(student.student_id)?.attendance_pct ?? null;
      const overall = line(items, work, ratings, attendancePct, false);
      const missing = work.filter((w) => w.is_missing).length;
      const atRisk: AtRiskReason[] = [];
      if (overall.score_pct !== null && overall.score_pct < settings.at_risk.score_pct) atRisk.push('SCORE');
      if (attendancePct !== null && attendancePct < settings.at_risk.attendance_pct) atRisk.push('ATTENDANCE');
      if (missing >= settings.at_risk.missing_homework) atRisk.push('MISSING_HOMEWORK');
      return {
        student: { id: student.student_id, full_name: student.full_name, roll_no: student.roll_no },
        overall,
        subjects: offerings.map((offering) => ({
          subject: offering.subject,
          ...line(
            items.filter((i) => i.subject_id === offering.subject.id),
            work.filter((w) => w.subject_id === offering.subject.id),
            ratings.filter((r) => r.offering_id === offering.id),
            attendancePct,
            true,
          ),
        })),
        missing_homework: missing,
        at_risk: atRisk,
        position: null,
      };
    });
    const ranked = positions(students.map((s) => ({ id: s.student.id, score: s.overall.score_pct, exams: s.overall.exams_pct })));
    for (const student of students) student.position = ranked.get(student.student.id) ?? null;

    return {
      section: { id: section.id, name: section.name, class_id: section.class_id, class_name: section.class?.class_name ?? '', session_id: session.id },
      period: { from, to, term: term ? { id: term.id, name: term.name } : null },
      weights,
      thresholds: settings.at_risk,
      students,
    };
  }
}
