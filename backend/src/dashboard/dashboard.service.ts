import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';
import { ClassEntity } from 'src/classes/entities/class.entity';
import {
  ClassStudentEntity,
  ClassStudentStatusEnum,
} from 'src/classes/entities/class-student.entity';
import { ExamEntity } from 'src/exams/entities/exam.entity';
import {
  StudentExamSubmissionEntity,
} from 'src/exams/entities/student-exam-answer.entity';
import { ExamLifecycleStatusEnum, TestAudienceEnum } from 'src/exams/enums/exam-wizard.enums';
import { GradingStatusEnum } from 'src/exams/enums/grading-status.enum';
import {
  computeGradingStatus,
  examHasManualQuestions,
  FINALIZED_SUBMISSION_STATUSES,
} from 'src/exams/utils/exam-grading.util';
import {
  DashboardActivityPeriodEnum,
  TeacherDashboardQueryDto,
} from './dto/teacher-dashboard-query.dto';

type ExamListMetrics = {
  participant_count: number;
  submitted_count: number;
};

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(ExamEntity)
    private readonly examRepo: Repository<ExamEntity>,
    @InjectRepository(ClassEntity)
    private readonly classRepo: Repository<ClassEntity>,
    @InjectRepository(ClassStudentEntity)
    private readonly classStudentRepo: Repository<ClassStudentEntity>,
    @InjectRepository(StudentExamSubmissionEntity)
    private readonly submissionRepo: Repository<StudentExamSubmissionEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async getTeacherDashboard(
    jwtPayload: JwtPayloadInterface,
    query: TeacherDashboardQueryDto,
  ): Promise<Record<string, unknown>> {
    const teacherId = jwtPayload.id;
    const now = new Date();
    const activityPeriod = query.activity_period ?? DashboardActivityPeriodEnum.MONTHLY;
    const calendarYear = query.calendar_year ?? now.getFullYear();
    const calendarMonth = query.calendar_month ?? now.getMonth() + 1;

    const [classes, exams] = await Promise.all([
      this.classRepo.find({
        where: { teacher_id: teacherId },
        relations: ['classStudents'],
        order: { created_at: 'DESC' },
      }),
      this.examRepo.find({
        where: { created_by: teacherId },
        relations: [
          'class',
          'questions',
          'questionSections',
          'questionSections.questions',
          'target_students',
        ],
        order: { exam_start_time: 'ASC' },
      }),
    ]);

    const classIds = classes.map((c) => c.id);
    const metrics = await this.loadExamListMetrics(exams);
    const gradingStats = await this.loadExamGradingStats(exams);

    const pendingGradingCount = this.computePendingGradingCount(
      exams,
      gradingStats,
      now,
    );

    const liveTests = exams
      .filter(
        (exam) =>
          this.computeExamLifecycleStatus(exam.exam_start_time, exam.exam_end_time) ===
          ExamLifecycleStatusEnum.ONGOING,
      )
      .map((exam) => {
        const examMetrics = metrics.get(exam.id)!;
        const endMs = new Date(exam.exam_end_time).getTime();
        const remainingSeconds = Math.max(0, Math.floor((endMs - now.getTime()) / 1000));

        return {
          id: exam.id,
          test_name: exam.test_name,
          class_name: exam.class?.class_name ?? null,
          participant_count: examMetrics.participant_count,
          submitted_count: examMetrics.submitted_count,
          remaining_seconds: remainingSeconds,
          exam_end_time: exam.exam_end_time,
        };
      });

    const upcomingTests = exams
      .filter(
        (exam) =>
          this.computeExamLifecycleStatus(exam.exam_start_time, exam.exam_end_time) ===
          ExamLifecycleStatusEnum.PENDING,
      )
      .slice(0, 20)
      .map((exam) => {
        const examMetrics = metrics.get(exam.id)!;
        return {
          id: exam.id,
          test_name: exam.test_name,
          class_name: exam.class?.class_name ?? null,
          exam_start_time: exam.exam_start_time,
          duration_minutes: exam.duration_minutes,
          student_count: examMetrics.participant_count,
        };
      });

    const studentsSummary = await this.buildStudentsSummary(classes, teacherId);
    const classesSummary = classes.map((cls) => ({
      id: cls.id,
      name: cls.class_name,
      student_count: cls.classStudents.filter(
        (cs) => cs.status === ClassStudentStatusEnum.JOINED,
      ).length,
    }));

    const topStudentsByClass = await this.loadTopStudentsByClass(teacherId, classes);
    const calendarEvents = this.buildCalendarEvents(exams, calendarYear, calendarMonth);
    const activity = this.buildActivityData(exams, metrics, activityPeriod, now);

    return {
      pending_grading_count: pendingGradingCount,
      live_tests: liveTests,
      students_summary: studentsSummary,
      upcoming_tests: upcomingTests,
      classes_summary: classesSummary,
      top_students_by_class: topStudentsByClass,
      calendar_events: calendarEvents,
      activity,
    };
  }

  private computePendingGradingCount(
    exams: ExamEntity[],
    gradingStats: Map<
      string,
      {
        submitted_submissions: Pick<StudentExamSubmissionEntity, 'is_graded'>[];
      }
    >,
    now: Date,
  ): number {
    let total = 0;

    for (const exam of exams) {
      if (new Date(exam.exam_end_time).getTime() >= now.getTime()) {
        continue;
      }

      const hasManualQuestions = examHasManualQuestions(exam);
      const stat = gradingStats.get(exam.id);
      if (!stat) {
        continue;
      }

      const gradingStatus = computeGradingStatus(
        exam,
        hasManualQuestions,
        stat.submitted_submissions,
      );

      if (gradingStatus === GradingStatusEnum.NEEDS_GRADING) {
        total += stat.submitted_submissions.filter((s) => !s.is_graded).length;
      }
    }

    return total;
  }

  private async buildStudentsSummary(
    classes: ClassEntity[],
    teacherId: string,
  ): Promise<{
    total: number;
    joined: number;
    pending: number;
    active: number;
  }> {
    const joinedStudentIds = new Set<string>();
    let pendingCount = 0;

    for (const cls of classes) {
      for (const cs of cls.classStudents ?? []) {
        if (cs.status === ClassStudentStatusEnum.JOINED && cs.student_id) {
          joinedStudentIds.add(cs.student_id);
        } else if (
          cs.status === ClassStudentStatusEnum.PENDING ||
          cs.status === ClassStudentStatusEnum.INVITED
        ) {
          pendingCount += 1;
        }
      }
    }

    const joined = joinedStudentIds.size;

    let activeCount = 0;
    if (joinedStudentIds.size > 0) {
      const activeRow = await this.dataSource
        .createQueryBuilder()
        .select('COUNT(DISTINCT submission.student_id)', 'cnt')
        .from('student_exam_submissions', 'submission')
        .innerJoin('exams', 'exam', 'exam.id = submission.exam_id')
        .where('exam.created_by = :teacherId', { teacherId })
        .andWhere('submission.student_id IN (:...studentIds)', {
          studentIds: [...joinedStudentIds],
        })
        .andWhere('submission.status IN (:...statuses)', {
          statuses: FINALIZED_SUBMISSION_STATUSES,
        })
        .getRawOne<{ cnt: string }>();
      activeCount = Number(activeRow?.cnt) || 0;
    }

    return {
      total: joined,
      joined,
      pending: pendingCount,
      active: activeCount,
    };
  }

  private async loadTopStudentsByClass(
    teacherId: string,
    classes: ClassEntity[],
  ): Promise<
    Array<{
      class_id: string;
      class_name: string;
      students: Array<{
        student_id: string;
        name: string;
        tests_taken: number;
        avg_score_percent: number | null;
      }>;
    }>
  > {
    const classIds = classes.map((c) => c.id);
    if (classIds.length === 0) {
      return [];
    }

    const rows = await this.dataSource
      .createQueryBuilder()
      .select('exam.class_id', 'class_id')
      .addSelect('class.class_name', 'class_name')
      .addSelect('submission.student_id', 'student_id')
      .addSelect('student.full_name', 'student_name')
      .addSelect('COUNT(submission.id)', 'tests_taken')
      .addSelect(
        `AVG(CASE WHEN submission.max_score > 0 THEN (submission.total_score::float / submission.max_score::float) * 100 ELSE NULL END)`,
        'avg_score_percent',
      )
      .from('student_exam_submissions', 'submission')
      .innerJoin('exams', 'exam', 'exam.id = submission.exam_id')
      .innerJoin('classes', 'class', 'class.id = exam.class_id')
      .innerJoin('users', 'student', 'student.id = submission.student_id')
      .innerJoin(
        'class_students',
        'cs',
        'cs.class_id = exam.class_id AND cs.student_id = submission.student_id AND cs.status = :joined',
        { joined: ClassStudentStatusEnum.JOINED },
      )
      .where('exam.created_by = :teacherId', { teacherId })
      .andWhere('exam.class_id IN (:...classIds)', { classIds })
      .andWhere('submission.status IN (:...statuses)', {
        statuses: FINALIZED_SUBMISSION_STATUSES,
      })
      .andWhere('submission.is_graded = true')
      .groupBy('exam.class_id')
      .addGroupBy('class.class_name')
      .addGroupBy('submission.student_id')
      .addGroupBy('student.full_name')
      .orderBy('avg_score_percent', 'DESC', 'NULLS LAST')
      .getRawMany<{
        class_id: string;
        class_name: string;
        student_id: string;
        student_name: string;
        tests_taken: string;
        avg_score_percent: string | null;
      }>();

    const byClass = new Map<
      string,
      {
        class_id: string;
        class_name: string;
        students: Array<{
          student_id: string;
          name: string;
          tests_taken: number;
          avg_score_percent: number | null;
        }>;
      }
    >();

    for (const row of rows) {
      const existing = byClass.get(row.class_id) ?? {
        class_id: row.class_id,
        class_name: row.class_name,
        students: [],
      };

      if (existing.students.length < 50) {
        existing.students.push({
          student_id: row.student_id,
          name: row.student_name,
          tests_taken: Number(row.tests_taken) || 0,
          avg_score_percent:
            row.avg_score_percent != null
              ? Math.round(Number(row.avg_score_percent) * 100) / 100
              : null,
        });
      }

      byClass.set(row.class_id, existing);
    }

    for (const cls of classes) {
      if (!byClass.has(cls.id)) {
        byClass.set(cls.id, {
          class_id: cls.id,
          class_name: cls.class_name,
          students: [],
        });
      }
    }

    return Array.from(byClass.values());
  }

  private buildCalendarEvents(
    exams: ExamEntity[],
    year: number,
    month: number,
  ): Array<{ year: number; month: number; day: number; test_count: number }> {
    const counts = new Map<number, number>();

    for (const exam of exams) {
      const start = new Date(exam.exam_start_time);
      if (start.getFullYear() !== year || start.getMonth() + 1 !== month) {
        continue;
      }
      const day = start.getDate();
      counts.set(day, (counts.get(day) ?? 0) + 1);
    }

    return Array.from(counts.entries())
      .sort(([a], [b]) => a - b)
      .map(([day, test_count]) => ({ year, month, day, test_count }));
  }

  private buildActivityData(
    exams: ExamEntity[],
    metrics: Map<string, ExamListMetrics>,
    period: DashboardActivityPeriodEnum,
    now: Date,
  ): {
    period: DashboardActivityPeriodEnum;
    data: Array<{ label: string; exam_count: number; participant_count: number }>;
  } {
    if (period === DashboardActivityPeriodEnum.DAILY) {
      return {
        period,
        data: this.buildDailyActivity(exams, metrics, now, 14),
      };
    }

    if (period === DashboardActivityPeriodEnum.WEEKLY) {
      return {
        period,
        data: this.buildWeeklyActivity(exams, metrics, now, 12),
      };
    }

    return {
      period,
      data: this.buildMonthlyActivity(exams, metrics, now, 12),
    };
  }

  private buildMonthlyActivity(
    exams: ExamEntity[],
    metrics: Map<string, ExamListMetrics>,
    now: Date,
    months: number,
  ): Array<{ label: string; exam_count: number; participant_count: number }> {
    const buckets: Array<{ label: string; exam_count: number; participant_count: number }> = [];

    for (let i = months - 1; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleString('en-US', { month: 'short' });
      buckets.push({ label, exam_count: 0, participant_count: 0 });
    }

    for (const exam of exams) {
      const start = new Date(exam.exam_start_time);
      const monthDiff =
        (start.getFullYear() - now.getFullYear()) * 12 + (start.getMonth() - now.getMonth());
      if (monthDiff > 0 || monthDiff < -(months - 1)) {
        continue;
      }
      const index = months - 1 + monthDiff;
      if (index < 0 || index >= buckets.length) {
        continue;
      }
      const examMetrics = metrics.get(exam.id);
      buckets[index].exam_count += 1;
      buckets[index].participant_count += examMetrics?.submitted_count ?? 0;
    }

    return buckets;
  }

  private buildWeeklyActivity(
    exams: ExamEntity[],
    metrics: Map<string, ExamListMetrics>,
    now: Date,
    weeks: number,
  ): Array<{ label: string; exam_count: number; participant_count: number }> {
    const startOfWeek = (date: Date): Date => {
      const d = new Date(date);
      const day = d.getDay();
      d.setDate(d.getDate() - day);
      d.setHours(0, 0, 0, 0);
      return d;
    };

    const currentWeekStart = startOfWeek(now);
    const buckets: Array<{ label: string; exam_count: number; participant_count: number; weekStart: Date }> =
      [];

    for (let i = weeks - 1; i >= 0; i -= 1) {
      const weekStart = new Date(currentWeekStart);
      weekStart.setDate(weekStart.getDate() - i * 7);
      const label = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      buckets.push({ label, exam_count: 0, participant_count: 0, weekStart });
    }

    for (const exam of exams) {
      const start = new Date(exam.exam_start_time);
      const examWeekStart = startOfWeek(start);
      const diffWeeks = Math.floor(
        (examWeekStart.getTime() - buckets[0].weekStart.getTime()) / (7 * 24 * 60 * 60 * 1000),
      );
      if (diffWeeks < 0 || diffWeeks >= weeks) {
        continue;
      }
      const examMetrics = metrics.get(exam.id);
      buckets[diffWeeks].exam_count += 1;
      buckets[diffWeeks].participant_count += examMetrics?.submitted_count ?? 0;
    }

    return buckets.map(({ label, exam_count, participant_count }) => ({
      label,
      exam_count,
      participant_count,
    }));
  }

  private buildDailyActivity(
    exams: ExamEntity[],
    metrics: Map<string, ExamListMetrics>,
    now: Date,
    days: number,
  ): Array<{ label: string; exam_count: number; participant_count: number }> {
    const buckets: Array<{ label: string; exam_count: number; participant_count: number; date: Date }> =
      [];

    for (let i = days - 1; i >= 0; i -= 1) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const label = d.toLocaleDateString('en-US', { weekday: 'short' });
      buckets.push({ label, exam_count: 0, participant_count: 0, date: d });
    }

    for (const exam of exams) {
      const start = new Date(exam.exam_start_time);
      start.setHours(0, 0, 0, 0);
      const diffDays = Math.floor(
        (start.getTime() - buckets[0].date.getTime()) / (24 * 60 * 60 * 1000),
      );
      if (diffDays < 0 || diffDays >= days) {
        continue;
      }
      const examMetrics = metrics.get(exam.id);
      buckets[diffDays].exam_count += 1;
      buckets[diffDays].participant_count += examMetrics?.submitted_count ?? 0;
    }

    return buckets.map(({ label, exam_count, participant_count }) => ({
      label,
      exam_count,
      participant_count,
    }));
  }

  private computeExamLifecycleStatus(start: Date, end: Date): ExamLifecycleStatusEnum {
    const now = Date.now();
    const t0 = new Date(start).getTime();
    const t1 = new Date(end).getTime();
    if (now < t0) {
      return ExamLifecycleStatusEnum.PENDING;
    }
    if (now > t1) {
      return ExamLifecycleStatusEnum.COMPLETED;
    }
    return ExamLifecycleStatusEnum.ONGOING;
  }

  private async loadExamListMetrics(exams: ExamEntity[]): Promise<Map<string, ExamListMetrics>> {
    const out = new Map<string, ExamListMetrics>();
    if (exams.length === 0) {
      return out;
    }

    const examIds = exams.map((e) => e.id);

    const submittedRows = await this.dataSource
      .createQueryBuilder()
      .select('submission.exam_id', 'exam_id')
      .addSelect('COUNT(DISTINCT submission.student_id)', 'cnt')
      .from('student_exam_submissions', 'submission')
      .where('submission.exam_id IN (:...examIds)', { examIds })
      .andWhere('submission.status IN (:...statuses)', {
        statuses: FINALIZED_SUBMISSION_STATUSES,
      })
      .groupBy('submission.exam_id')
      .getRawMany<{ exam_id: string; cnt: string }>();

    const submittedByExam = new Map(
      submittedRows.map((r) => [r.exam_id, Number(r.cnt) || 0]),
    );

    const classIds = [
      ...new Set(
        exams
          .filter(
            (e) =>
              e.test_audience === TestAudienceEnum.SELECTED_CLASS && e.class_id != null,
          )
          .map((e) => e.class_id as string),
      ),
    ];

    const joinedByClass = new Map<string, number>();
    if (classIds.length > 0) {
      const joinedRows = await this.classStudentRepo
        .createQueryBuilder('cs')
        .select('cs.class_id', 'class_id')
        .addSelect('COUNT(*)', 'cnt')
        .where('cs.class_id IN (:...classIds)', { classIds })
        .andWhere('cs.status = :status', { status: ClassStudentStatusEnum.JOINED })
        .andWhere('cs.student_id IS NOT NULL')
        .groupBy('cs.class_id')
        .getRawMany<{ class_id: string; cnt: string }>();
      joinedRows.forEach((r) => joinedByClass.set(r.class_id, Number(r.cnt) || 0));
    }

    const excludedRows = await this.dataSource
      .createQueryBuilder()
      .select('ees.exam_id', 'exam_id')
      .addSelect('COUNT(*)', 'cnt')
      .from('exam_excluded_students', 'ees')
      .where('ees.exam_id IN (:...examIds)', { examIds })
      .groupBy('ees.exam_id')
      .getRawMany<{ exam_id: string; cnt: string }>();

    const excludedByExam = new Map(
      excludedRows.map((r) => [r.exam_id, Number(r.cnt) || 0]),
    );

    const specificExamIds = exams
      .filter((e) => e.test_audience === TestAudienceEnum.SPECIFIC_STUDENTS)
      .map((e) => e.id);

    const targetByExam = new Map<string, number>();
    if (specificExamIds.length > 0) {
      const targetRows = await this.dataSource
        .createQueryBuilder()
        .select('ets.exam_id', 'exam_id')
        .addSelect('COUNT(*)', 'cnt')
        .from('exam_target_students', 'ets')
        .where('ets.exam_id IN (:...examIds)', { examIds: specificExamIds })
        .groupBy('ets.exam_id')
        .getRawMany<{ exam_id: string; cnt: string }>();
      targetRows.forEach((r) => targetByExam.set(r.exam_id, Number(r.cnt) || 0));
    }

    for (const exam of exams) {
      const submitted_count = submittedByExam.get(exam.id) ?? 0;
      let participant_count = 0;

      if (exam.test_audience === TestAudienceEnum.ANYONE) {
        participant_count = 0;
      } else if (
        exam.test_audience === TestAudienceEnum.SELECTED_CLASS &&
        exam.class_id
      ) {
        const joined = joinedByClass.get(exam.class_id) ?? 0;
        const excluded = excludedByExam.get(exam.id) ?? 0;
        participant_count = Math.max(0, joined - excluded);
      } else if (exam.test_audience === TestAudienceEnum.SPECIFIC_STUDENTS) {
        participant_count =
          targetByExam.get(exam.id) ?? exam.target_students?.length ?? 0;
      }

      out.set(exam.id, { participant_count, submitted_count });
    }

    return out;
  }

  private async loadExamGradingStats(exams: ExamEntity[]): Promise<
    Map<
      string,
      {
        submitted_submissions: Pick<StudentExamSubmissionEntity, 'is_graded'>[];
      }
    >
  > {
    const out = new Map<
      string,
      {
        submitted_submissions: Pick<StudentExamSubmissionEntity, 'is_graded'>[];
      }
    >();

    if (exams.length === 0) {
      return out;
    }

    const examIds = exams.map((exam) => exam.id);
    const submissions = await this.submissionRepo.find({
      where: {
        exam_id: In(examIds),
        status: In(FINALIZED_SUBMISSION_STATUSES),
      },
      select: ['id', 'exam_id', 'is_graded'],
    });

    const submissionsByExam = new Map<string, StudentExamSubmissionEntity[]>();
    for (const submission of submissions) {
      const existing = submissionsByExam.get(submission.exam_id) ?? [];
      existing.push(submission);
      submissionsByExam.set(submission.exam_id, existing);
    }

    for (const exam of exams) {
      const examSubmissions = submissionsByExam.get(exam.id) ?? [];
      out.set(exam.id, { submitted_submissions: examSubmissions });
    }

    return out;
  }
}
