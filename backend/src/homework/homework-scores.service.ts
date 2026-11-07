import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { GuardiansService } from 'src/academics/guardians.service';
import { AcademicSessionStatusEnum } from 'src/academics/entities/academic-session.entity';
import { AUDIT_ACTIONS } from 'src/audit/audit-actions';
import { AuditService } from 'src/audit/audit.service';
import { Tenant } from 'src/common/tenancy/tenant-context';
import { NOTIFICATION_EVENTS, NotificationChannelEnum, RecipientTypeEnum } from 'src/notifications/notification.constants';
import { NotificationsService, OutboxMessage } from 'src/notifications/notifications.service';
import { OrgSettingsService } from 'src/organizations/org-settings.service';
import { Grade } from 'src/performance/grading-scale.util';
import { GradingScaleService } from 'src/performance/grading-scale.service';
import { schoolDateIn } from 'src/common/utils/school-date.util';
import { HomeworkScoreRowDto, RemindMissingDto, ReturnSubmissionDto } from './dto/homework.dto';
import { HomeworkRatings, HomeworkScoreEntity } from './entities/homework-score.entity';
import { HomeworkSubmissionEntity, SubmissionStatusEnum } from './entities/homework-submission.entity';
import { HomeworkEntity, HomeworkStatusEnum, HomeworkTypeEnum } from './entities/homework.entity';
import { HomeworkClock } from './homework-clock';
import { HOMEWORK_ERRORS } from './homework-errors';
import { lateScore } from './homework-penalty';
import { HomeworkService } from './homework.service';

type Actor = { id: string; full_name?: string | null };

export interface ScoreView {
  raw_score: number | null;
  penalty: number;
  final_score: number | null;
  total_marks: number | null;
  /** final ÷ total, 0–100, two decimals; null without a score or total. */
  percent: number | null;
  grade: Grade | null;
  feedback: string | null;
  ratings: HomeworkRatings | null;
  is_missing: boolean;
  scored_at: Date | null;
}

/** One student in the review list, paper grid and overview (HW-04, HW-05, HW-06). */
export interface GridRow {
  student: { id: string; full_name: string; roll_no: string | null };
  latest: { id: string; version: number; submitted_at: Date; is_late: boolean; late_minutes: number | null; status: SubmissionStatusEnum } | null;
  versions: number;
  score: ScoreView | null;
}

export interface HomeworkGrid {
  homework: { id: string; total_marks: number | null; submission_type: HomeworkTypeEnum; due_at: Date | null; scores_published_at: Date | null };
  /** HW-06 counts: everyone it is set to, handed in, late, not handed in, scored. */
  counts: { students: number; handed_in: number; late: number; missing: number; scored: number };
  rows: GridRow[];
}

const num = (value: string | null | undefined) => (value === null || value === undefined ? null : Number(value));

/**
 * Reviewing and scoring homework (HW-04, HW-05, HW-06): a score out of the total with feedback for
 * each student, the late penalty taken off automatically (organisation setting × how late the
 * scored hand-in was), a grid for a whole class at once (paper homework, "not handed in"), return
 * for redo, publishing the scores (students see them from then on), and reminding the students who
 * have not handed it in, in-app and optionally by SMS to their guardians (organisation credits).
 */
@Injectable()
export class HomeworkScoresService {
  constructor(
    @InjectRepository(HomeworkScoreEntity)
    private readonly scoreRepo: Repository<HomeworkScoreEntity>,
    private readonly dataSource: DataSource,
    private readonly homework: HomeworkService,
    private readonly orgSettings: OrgSettingsService,
    private readonly grading: GradingScaleService,
    private readonly guardians: GuardiansService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly clock: HomeworkClock,
  ) {}

  /** Everyone the homework is set to (and anyone who handed it in) with their latest hand-in and score. */
  async grid(tenant: Tenant, userId: string, homeworkId: string): Promise<HomeworkGrid> {
    const homework = await this.staffHomework(tenant, userId, homeworkId);
    const [students, submissions, scores] = await Promise.all([
      this.homework.studentsOf(homework),
      this.dataSource.getRepository(HomeworkSubmissionEntity).find({ where: { homework_id: homework.id }, order: { version: 'DESC' } }),
      this.scoreRepo.find({ where: { homework_id: homework.id } }),
    ]);
    const people = new Map(students.map((s) => [s.student_id, { id: s.student_id, full_name: s.full_name, roll_no: s.roll_no }]));
    const extra = [...new Set([...submissions.map((s) => s.student_id), ...scores.map((s) => s.student_id)])].filter((id) => !people.has(id));
    if (extra.length) {
      const users: { id: string; full_name: string }[] = await this.dataSource.query(`SELECT id, full_name FROM users WHERE id = ANY($1)`, [extra]);
      for (const u of users) people.set(u.id, { id: u.id, full_name: u.full_name, roll_no: null });
    }
    const total = num(homework.total_marks);
    const now = this.clock.now();
    const rows: GridRow[] = [];
    for (const student of people.values()) {
      const own = submissions.filter((s) => s.student_id === student.id);
      const score = scores.find((s) => s.student_id === student.id);
      rows.push({
        student,
        versions: own.length,
        latest: own[0]
          ? { id: own[0].id, version: own[0].version, submitted_at: own[0].submitted_at, is_late: own[0].is_late, late_minutes: own[0].late_minutes, status: own[0].status }
          : null,
        score: score ? await this.scoreView(homework.organization_id, score, total) : null,
      });
    }
    const pastDue = homework.due_at !== null && now.getTime() > homework.due_at.getTime();
    const counts = {
      students: rows.length,
      handed_in: rows.filter((r) => r.latest).length,
      late: rows.filter((r) => r.latest?.is_late).length,
      // Paper homework is "missing" only when the teacher marks it so; other homework once due without a hand-in.
      missing: rows.filter((r) => r.score?.is_missing || (homework.submission_type !== HomeworkTypeEnum.PAPER && pastDue && !r.latest && !r.score)).length,
      scored: rows.filter((r) => r.score && (r.score.final_score !== null || r.score.is_missing)).length,
    };
    return {
      homework: { id: homework.id, total_marks: total, submission_type: homework.submission_type, due_at: homework.due_at, scores_published_at: homework.scores_published_at },
      counts,
      rows,
    };
  }

  /** Saves scores for one or many students (the review screen or the paper grid). */
  async save(tenant: Tenant, actor: Actor, homeworkId: string, rows: HomeworkScoreRowDto[]): Promise<HomeworkGrid> {
    const homework = await this.staffHomework(tenant, actor.id, homeworkId, true);
    const total = num(homework.total_marks);
    const settings = await this.orgSettings.getHomework(tenant.organizationId);
    const setTo = new Set((await this.homework.studentsOf(homework)).map((s) => s.student_id));
    const submissions = await this.dataSource.getRepository(HomeworkSubmissionEntity).find({ where: { homework_id: homework.id }, order: { version: 'DESC' } });
    const handedIn = new Set(submissions.map((s) => s.student_id));
    for (const row of rows) {
      if (!setTo.has(row.student_id) && !handedIn.has(row.student_id)) {
        throw new BadRequestException({ message: 'This homework is not set to that student', code: HOMEWORK_ERRORS.STUDENT_NOT_SET });
      }
      if (row.raw_score !== undefined && row.raw_score !== null && (total === null || row.raw_score > total)) {
        throw new BadRequestException({ message: total === null ? 'This homework has no total marks' : `At most ${total}`, code: HOMEWORK_ERRORS.SCORE_INVALID, details: { total } });
      }
    }

    const now = this.clock.now();
    const changes: { studentId: string; before: unknown; after: unknown }[] = [];
    await this.dataSource.transaction(async (manager) => {
      for (const row of rows) {
        const existing = await manager.findOne(HomeworkScoreEntity, { where: { homework_id: homework.id, student_id: row.student_id } });
        const latest = submissions.find((s) => s.student_id === row.student_id) ?? null;
        const score = existing ?? manager.create(HomeworkScoreEntity, { organization_id: tenant.organizationId, homework_id: homework.id, student_id: row.student_id });
        const before = existing ? scoreState(existing) : null;
        if (row.feedback !== undefined) score.feedback = row.feedback || null;
        if (row.ratings !== undefined) score.ratings = row.ratings && Object.keys(row.ratings).length ? { ...row.ratings } : null;
        if (row.is_missing !== undefined) score.is_missing = row.is_missing;
        if (score.is_missing) {
          // Never handed in: nothing to score, the final score is 0.
          score.raw_score = null;
          score.penalty = '0';
          score.final_score = '0';
          score.submission_id = null;
        } else if (row.raw_score !== undefined) {
          if (row.raw_score === null) {
            score.raw_score = null;
            score.penalty = '0';
            score.final_score = null;
          } else {
            const { penalty, final } = lateScore(row.raw_score, settings.late_penalty, latest?.is_late ? latest.late_minutes : null);
            score.raw_score = String(row.raw_score);
            score.penalty = String(penalty);
            score.final_score = String(final);
          }
          score.submission_id = latest?.id ?? null;
        } else if (existing?.is_missing === true && row.is_missing === false) {
          score.final_score = null;
        }
        score.scored_by = actor.id;
        score.scored_at = now;
        await manager.save(score);
        // The scored hand-in is now SCORED (no more hand-ins unless it is returned for redo).
        if (latest && score.final_score !== null && !score.is_missing && latest.status !== SubmissionStatusEnum.SCORED) {
          await manager.update(HomeworkSubmissionEntity, { id: latest.id }, { status: SubmissionStatusEnum.SCORED });
        }
        const after = scoreState(score);
        if (JSON.stringify(before) !== JSON.stringify(after)) changes.push({ studentId: row.student_id, before, after });
      }
    });
    for (const change of changes) {
      this.audit.record({
        action: AUDIT_ACTIONS.HOMEWORK_SCORE,
        organizationId: tenant.organizationId,
        actorId: actor.id,
        entityType: 'homework_score',
        entityId: homework.id,
        before: change.before ? { student_id: change.studentId, ...(change.before as object) } : null,
        after: { student_id: change.studentId, ...(change.after as object) },
      });
    }
    return this.grid(tenant, actor.id, homeworkId);
  }

  /** Returns the student's latest hand-in for redo: one more hand-in is allowed; the student is told. */
  async returnForRedo(tenant: Tenant, actor: Actor, homeworkId: string, submissionId: string, dto: ReturnSubmissionDto): Promise<HomeworkGrid> {
    const homework = await this.staffHomework(tenant, actor.id, homeworkId, true);
    const submissions = this.dataSource.getRepository(HomeworkSubmissionEntity);
    const submission = await submissions.findOne({ where: { id: submissionId, homework_id: homework.id } });
    if (!submission) throw new NotFoundException({ message: 'Submission not found', code: HOMEWORK_ERRORS.NOT_FOUND });
    const latest = await submissions.findOne({ where: { homework_id: homework.id, student_id: submission.student_id }, order: { version: 'DESC' } });
    if (latest?.id !== submission.id) throw new ConflictException({ message: 'Return the latest hand-in', code: HOMEWORK_ERRORS.NOT_LATEST });
    if (submission.status === SubmissionStatusEnum.RETURNED) return this.grid(tenant, actor.id, homeworkId);

    await this.dataSource.transaction(async (manager) => {
      await manager.update(HomeworkSubmissionEntity, { id: submission.id }, { status: SubmissionStatusEnum.RETURNED });
      await this.notifications.notifyUsers(
        {
          eventType: NOTIFICATION_EVENTS.HOMEWORK_RETURNED,
          organizationId: tenant.organizationId,
          userIds: [submission.student_id],
          variables: { title: homework.title, note: dto.note ?? '', homework_id: homework.id, path: `/homework/${homework.id}` },
          dedupeKey: `${NOTIFICATION_EVENTS.HOMEWORK_RETURNED}:${submission.id}`,
          createdBy: actor.id,
        },
        manager,
      );
    });
    this.audit.record({
      action: AUDIT_ACTIONS.HOMEWORK_RETURN,
      organizationId: tenant.organizationId,
      actorId: actor.id,
      entityType: 'homework_submission',
      entityId: submission.id,
      before: { status: submission.status },
      after: { status: SubmissionStatusEnum.RETURNED, student_id: submission.student_id, version: submission.version },
      reason: dto.note,
    });
    return this.grid(tenant, actor.id, homeworkId);
  }

  /** Publishes the scores: students see their score and feedback from now on, and are told once. */
  async publishScores(tenant: Tenant, actor: Actor, homeworkId: string): Promise<HomeworkGrid> {
    const homework = await this.staffHomework(tenant, actor.id, homeworkId, true);
    const now = this.clock.now();
    const scored = await this.scoreRepo.find({ where: { homework_id: homework.id } });
    await this.dataSource.transaction(async (manager) => {
      await manager.update(HomeworkEntity, { id: homework.id }, { scores_published_at: now, updated_by: actor.id, updated_at: now });
      const userIds = scored.filter((s) => s.final_score !== null).map((s) => s.student_id);
      if (userIds.length) {
        await this.notifications.notifyUsers(
          {
            eventType: NOTIFICATION_EVENTS.HOMEWORK_SCORES_PUBLISHED,
            organizationId: tenant.organizationId,
            userIds,
            variables: { title: homework.title, homework_id: homework.id, path: `/homework/${homework.id}` },
            // Once per student: publishing again (after more scores) tells only those not told yet.
            dedupeKey: `${NOTIFICATION_EVENTS.HOMEWORK_SCORES_PUBLISHED}:${homework.id}`,
            createdBy: actor.id,
          },
          manager,
        );
      }
    });
    this.audit.record({
      action: AUDIT_ACTIONS.HOMEWORK_PUBLISH_SCORES,
      organizationId: tenant.organizationId,
      actorId: actor.id,
      entityType: 'homework',
      entityId: homework.id,
      before: { scores_published_at: homework.scores_published_at },
      after: { scores_published_at: now, scores: scored.length },
    });
    return this.grid(tenant, actor.id, homeworkId);
  }

  /**
   * "Remind missing students" (HW-06): an in-app reminder to each student it is set to who has not
   * handed it in, and with `sms_guardians` an SMS to their guardians (organisation credits). Once a
   * day per student and guardian. Not for paper homework.
   */
  async remindMissing(tenant: Tenant, actor: Actor, homeworkId: string, dto: RemindMissingDto): Promise<{ students: number; guardian_sms: number }> {
    const homework = await this.staffHomework(tenant, actor.id, homeworkId, true);
    if (homework.submission_type === HomeworkTypeEnum.PAPER) {
      throw new ConflictException({ message: 'Paper homework is not handed in on the app', code: HOMEWORK_ERRORS.PAPER_NO_SUBMISSION });
    }
    const students = await this.homework.studentsOf(homework);
    const handedIn = new Set(
      (await this.dataSource.getRepository(HomeworkSubmissionEntity).find({ where: { homework_id: homework.id }, select: ['student_id'] })).map((s) => s.student_id),
    );
    const missing = students.filter((s) => !handedIn.has(s.student_id));
    const day = schoolDateIn(await this.orgSettings.timeZone(tenant.organizationId), this.clock.now());
    let sms = 0;
    if (missing.length) {
      await this.notifications.notifyUsers({
        eventType: NOTIFICATION_EVENTS.HOMEWORK_REMINDER,
        organizationId: tenant.organizationId,
        userIds: missing.map((s) => s.student_id),
        variables: { title: homework.title, due_at: homework.due_at ? homework.due_at.toISOString() : 'NO_DUE_DATE', homework_id: homework.id, path: `/homework/${homework.id}` },
        dedupeKey: `${NOTIFICATION_EVENTS.HOMEWORK_REMINDER}:${homework.id}:${day}`,
        createdBy: actor.id,
      });
      if (dto.sms_guardians) {
        const organizationName = await this.orgSettings.organizationName(tenant.organizationId);
        for (const student of missing) {
          const contacts = await this.guardians.contactsForStudent(tenant.organizationId, student.student_id);
          const ids = await this.notifications.enqueue(
            contacts.map(
              (guardian): OutboxMessage => ({
                eventType: NOTIFICATION_EVENTS.HOMEWORK_MISSING,
                channel: NotificationChannelEnum.SMS,
                organizationId: tenant.organizationId,
                address: guardian.phone,
                recipientType: RecipientTypeEnum.GUARDIAN,
                recipientId: guardian.id,
                locale: guardian.locale,
                variables: { student_id: student.student_id, student_name: student.full_name, title: homework.title, organization_name: organizationName },
                dedupeKey: `${NOTIFICATION_EVENTS.HOMEWORK_MISSING}:${homework.id}:${student.student_id}:${guardian.id}:${day}`,
                createdBy: actor.id,
              }),
            ),
          );
          sms += ids.length;
        }
      }
    }
    this.audit.record({
      action: AUDIT_ACTIONS.HOMEWORK_REMIND,
      organizationId: tenant.organizationId,
      actorId: actor.id,
      entityType: 'homework',
      entityId: homework.id,
      after: { students: missing.length, guardian_sms: sms },
    });
    return { students: missing.length, guardian_sms: sms };
  }

  /** The student's own score for a homework, once published (HW-04); null before. */
  async mine(organizationId: string, homework: HomeworkEntity, studentId: string): Promise<ScoreView | null> {
    if (!homework.scores_published_at) return null;
    const score = await this.scoreRepo.findOne({ where: { homework_id: homework.id, student_id: studentId } });
    if (!score || (score.final_score === null && !score.is_missing)) return null;
    return this.scoreView(organizationId, score, num(homework.total_marks));
  }

  // ------------------------------------------------------------------ helpers

  private async scoreView(organizationId: string, score: HomeworkScoreEntity, total: number | null): Promise<ScoreView> {
    const final = num(score.final_score);
    const percent = final !== null && total ? Math.round((final / total) * 10_000) / 100 : null;
    return {
      raw_score: num(score.raw_score),
      penalty: Number(score.penalty ?? 0),
      final_score: final,
      total_marks: total,
      percent,
      grade: percent === null ? null : await this.grading.gradeFor(organizationId, percent),
      feedback: score.feedback,
      ratings: score.ratings,
      is_missing: score.is_missing,
      scored_at: score.scored_at,
    };
  }

  /** A homework the caller manages; with `open`, a published one in an open session. */
  private async staffHomework(tenant: Tenant, userId: string, homeworkId: string, open = false): Promise<HomeworkEntity> {
    if (!this.homework.isStaff(tenant)) {
      throw new ForbiddenException({ message: 'Only staff of this workspace score homework', code: HOMEWORK_ERRORS.NOT_ALLOWED });
    }
    const homework = await this.dataSource.getRepository(HomeworkEntity).findOne({
      where: { id: homeworkId, organization_id: tenant.organizationId },
      relations: ['session'],
    });
    if (!homework || !(await this.homework.canSee(tenant, userId, homework))) {
      throw new NotFoundException({ message: 'Homework not found', code: HOMEWORK_ERRORS.NOT_FOUND });
    }
    if (open) {
      if (homework.status !== HomeworkStatusEnum.PUBLISHED) {
        throw new ConflictException({ message: 'Publish the homework first', code: HOMEWORK_ERRORS.WRONG_STATUS });
      }
      if (homework.session?.status === AcademicSessionStatusEnum.CLOSED) {
        throw new ConflictException({ message: 'This session is closed; its homework is read-only', code: HOMEWORK_ERRORS.SESSION_CLOSED });
      }
    }
    return homework;
  }
}

/** The score fields the audit log keeps. */
const scoreState = (score: HomeworkScoreEntity) => ({
  raw_score: score.raw_score,
  penalty: score.penalty,
  final_score: score.final_score,
  is_missing: score.is_missing,
  feedback: score.feedback,
  ratings: score.ratings,
});

