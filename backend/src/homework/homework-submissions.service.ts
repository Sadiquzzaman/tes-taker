import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Not, Repository } from 'typeorm';
import { AcademicSessionStatusEnum } from 'src/academics/entities/academic-session.entity';
import { Tenant } from 'src/common/tenancy/tenant-context';
import { FileObjectEntity } from 'src/files/entities/file-object.entity';
import { FilePurposeEnum, FileStatusEnum } from 'src/files/file-rules';
import { HomeworkSettings, OrgSettingsService } from 'src/organizations/org-settings.service';
import { UserEntity } from 'src/user/entities/user.entity';
import { SubmitHomeworkDto } from './dto/homework.dto';
import { HomeworkSubmissionEntity, SubmissionStatusEnum } from './entities/homework-submission.entity';
import { HomeworkEntity, HomeworkStatusEnum, HomeworkTypeEnum } from './entities/homework.entity';
import { SubmissionFileEntity } from './entities/submission-file.entity';
import { HomeworkClock } from './homework-clock';
import { HOMEWORK_ERRORS } from './homework-errors';
import { HomeworkService } from './homework.service';

export interface SubmissionFileView {
  id: string;
  name: string | null;
  mime: string | null;
  size_bytes: number | null;
  url: string;
}

export interface SubmissionView {
  id: string;
  version: number;
  text_answer: string | null;
  submitted_at: Date;
  is_late: boolean;
  late_minutes: number | null;
  status: SubmissionStatusEnum;
  files: SubmissionFileView[];
}

/** The student's hand-ins of one homework, newest first, and whether they may hand in (again). */
export interface MySubmissions {
  submissions: SubmissionView[];
  can_submit: boolean;
  /** Why not, as an error code, when can_submit is false. */
  blocked_by: string | null;
  /** Hand-ins still allowed after this one (the first counts too). */
  submissions_left: number;
  /** The due time has passed: a hand-in now is late (or refused when late work is not accepted). */
  late_now: boolean;
  max_files: number;
}

/** One student in the staff list: their latest hand-in, if any. */
export interface StudentSubmissionRow {
  student: { id: string; full_name: string; roll_no: string | null };
  latest: (Omit<SubmissionView, 'files' | 'text_answer'> & { file_count: number }) | null;
  versions: number;
}

/**
 * Handing homework in (HW-03): a student uploads files (photos are combined into a PDF in the
 * browser) or types an answer. After the due time it is marked late with how late, or refused when
 * the organisation does not accept late work. A student may hand in again up to the organisation's
 * limit until the teacher scores it; a homework returned for redo allows one more. Every version is
 * kept for the teacher. Paper homework is not handed in on the app.
 */
@Injectable()
export class HomeworkSubmissionsService {
  constructor(
    @InjectRepository(HomeworkSubmissionEntity)
    private readonly submissionRepo: Repository<HomeworkSubmissionEntity>,
    private readonly dataSource: DataSource,
    private readonly homework: HomeworkService,
    private readonly orgSettings: OrgSettingsService,
    private readonly clock: HomeworkClock,
  ) {}

  async mine(tenant: Tenant, userId: string, homeworkId: string): Promise<MySubmissions> {
    const homework = await this.publishedFor(tenant, userId, homeworkId);
    const settings = await this.orgSettings.getHomework(tenant.organizationId);
    const rows = await this.submissionRepo.find({
      where: { homework_id: homework.id, student_id: userId },
      relations: ['files', 'files.file'],
      order: { version: 'DESC' },
    });
    const blockedBy = this.blockedBy(homework, rows, settings);
    return {
      submissions: rows.map(view),
      can_submit: blockedBy === null,
      blocked_by: blockedBy,
      submissions_left: Math.max(0, allowedCount(rows, settings) - rows.length),
      late_now: Boolean(homework.due_at && this.clock.now().getTime() > homework.due_at.getTime()),
      max_files: settings.max_files,
    };
  }

  async submit(tenant: Tenant, userId: string, homeworkId: string, dto: SubmitHomeworkDto): Promise<MySubmissions> {
    const homework = await this.publishedFor(tenant, userId, homeworkId);
    const settings = await this.orgSettings.getHomework(tenant.organizationId);
    const fileIds = [...new Set(dto.file_ids ?? [])];
    const text = dto.text_answer?.trim() || null;
    if (homework.submission_type === HomeworkTypeEnum.FILE && fileIds.length === 0) this.empty();
    if (homework.submission_type === HomeworkTypeEnum.TEXT && !text) this.empty();
    if (fileIds.length > settings.max_files) {
      throw new BadRequestException({ message: `At most ${settings.max_files} files`, code: HOMEWORK_ERRORS.TOO_MANY_FILES, details: { max_files: settings.max_files } });
    }
    if (fileIds.length) await this.checkFiles(tenant.organizationId, userId, fileIds);

    const now = this.clock.now();
    await this.dataSource.transaction(async (manager) => {
      // One hand-in at a time per student and homework: lock their earlier versions' homework row.
      await manager.query(`SELECT id FROM homework WHERE id = $1 FOR UPDATE`, [homework.id]);
      const rows = await manager.find(HomeworkSubmissionEntity, { where: { homework_id: homework.id, student_id: userId }, order: { version: 'DESC' } });
      const blockedBy = this.blockedBy(homework, rows, settings);
      if (blockedBy) throw new ConflictException({ message: 'You cannot hand this in now', code: blockedBy });
      const late = homework.due_at !== null && now.getTime() > homework.due_at.getTime();
      const saved = await manager.save(
        manager.create(HomeworkSubmissionEntity, {
          organization_id: tenant.organizationId,
          homework_id: homework.id,
          student_id: userId,
          version: (rows[0]?.version ?? 0) + 1,
          text_answer: text,
          submitted_at: now,
          is_late: late,
          late_minutes: late ? Math.ceil((now.getTime() - (homework.due_at as Date).getTime()) / 60_000) : null,
          status: SubmissionStatusEnum.SUBMITTED,
        }),
      );
      if (fileIds.length) {
        await manager.insert(
          SubmissionFileEntity,
          fileIds.map((file_id, page_order) => ({ submission_id: saved.id, file_id, page_order })),
        );
      }
    });
    return this.mine(tenant, userId, homeworkId);
  }

  /** Staff: every student the homework is set to, with their latest hand-in (HW-06 builds on this). */
  async forStaff(tenant: Tenant, userId: string, homeworkId: string): Promise<StudentSubmissionRow[]> {
    const homework = await this.staffHomework(tenant, userId, homeworkId);
    const students = await this.homework.studentsOf(homework);
    const rows = await this.submissionRepo.find({
      where: { homework_id: homework.id },
      relations: ['files'],
      order: { version: 'DESC' },
    });
    // Students who handed in and later left the class still show.
    const known = new Set(students.map((s) => s.student_id));
    const left = [...new Set(rows.map((r) => r.student_id).filter((id) => !known.has(id)))];
    const leftNames = left.length
      ? await this.dataSource.getRepository(UserEntity).find({ where: { id: In(left) }, select: ['id', 'full_name'] })
      : [];
    const people = [
      ...students.map((s) => ({ id: s.student_id, full_name: s.full_name, roll_no: s.roll_no })),
      ...leftNames.map((u) => ({ id: u.id, full_name: u.full_name, roll_no: null })),
    ];
    return people.map((student) => {
      const own = rows.filter((r) => r.student_id === student.id);
      const latest = own[0];
      return {
        student,
        versions: own.length,
        latest: latest
          ? {
              id: latest.id,
              version: latest.version,
              submitted_at: latest.submitted_at,
              is_late: latest.is_late,
              late_minutes: latest.late_minutes,
              status: latest.status,
              file_count: latest.files?.length ?? 0,
            }
          : null,
      };
    });
  }

  /** Staff: one hand-in with its answer and files, and the student's other versions. */
  async oneForStaff(tenant: Tenant, userId: string, homeworkId: string, submissionId: string): Promise<SubmissionView & { student: { id: string; full_name: string }; versions: SubmissionView[] }> {
    const homework = await this.staffHomework(tenant, userId, homeworkId);
    const submission = await this.submissionRepo.findOne({
      where: { id: submissionId, homework_id: homework.id },
      relations: ['student', 'files', 'files.file'],
    });
    if (!submission) throw new NotFoundException({ message: 'Submission not found', code: HOMEWORK_ERRORS.NOT_FOUND });
    const versions = await this.submissionRepo.find({
      where: { homework_id: homework.id, student_id: submission.student_id },
      relations: ['files', 'files.file'],
      order: { version: 'DESC' },
    });
    return {
      ...view(submission),
      student: { id: submission.student_id, full_name: submission.student?.full_name ?? '' },
      versions: versions.map(view),
    };
  }

  /** Students who handed the homework in (any version), for the 24-hour reminder. */
  async studentIdsWhoSubmitted(homeworkId: string): Promise<Set<string>> {
    const rows: { student_id: string }[] = await this.submissionRepo
      .createQueryBuilder('s')
      .select('DISTINCT s.student_id', 'student_id')
      .where('s.homework_id = :homeworkId', { homeworkId })
      .getRawMany();
    return new Set(rows.map((r) => r.student_id));
  }

  // ------------------------------------------------------------------ helpers

  /** Why the student may not hand in now (an error code), or null. */
  private blockedBy(homework: HomeworkEntity, rows: HomeworkSubmissionEntity[], settings: HomeworkSettings): string | null {
    if (homework.submission_type === HomeworkTypeEnum.PAPER) return HOMEWORK_ERRORS.PAPER_NO_SUBMISSION;
    if (homework.session?.status === AcademicSessionStatusEnum.CLOSED) return HOMEWORK_ERRORS.SESSION_CLOSED;
    const latest = rows[0];
    if (latest?.status === SubmissionStatusEnum.SCORED) return HOMEWORK_ERRORS.ALREADY_SCORED;
    if (latest?.status !== SubmissionStatusEnum.RETURNED && rows.length >= allowedCount(rows, settings)) return HOMEWORK_ERRORS.NO_MORE_SUBMISSIONS;
    if (homework.due_at && this.clock.now().getTime() > homework.due_at.getTime() && !settings.late_allowed) return HOMEWORK_ERRORS.LATE_NOT_ALLOWED;
    return null;
  }

  /** A published homework set to the student (anything else is "not found" to them). */
  private async publishedFor(tenant: Tenant, userId: string, homeworkId: string): Promise<HomeworkEntity> {
    if (this.homework.isStaff(tenant)) {
      throw new ForbiddenException({ message: 'Only students hand homework in', code: HOMEWORK_ERRORS.NOT_ALLOWED });
    }
    const homework = await this.dataSource.getRepository(HomeworkEntity).findOne({
      where: { id: homeworkId, organization_id: tenant.organizationId, status: HomeworkStatusEnum.PUBLISHED },
      relations: ['session'],
    });
    if (!homework || !(await this.homework.isSetTo(homework, userId))) {
      throw new NotFoundException({ message: 'Homework not found', code: HOMEWORK_ERRORS.NOT_FOUND });
    }
    return homework;
  }

  private async staffHomework(tenant: Tenant, userId: string, homeworkId: string): Promise<HomeworkEntity> {
    if (!this.homework.isStaff(tenant)) {
      throw new ForbiddenException({ message: 'Only staff of this workspace see submissions', code: HOMEWORK_ERRORS.NOT_ALLOWED });
    }
    const homework = await this.dataSource.getRepository(HomeworkEntity).findOne({ where: { id: homeworkId, organization_id: tenant.organizationId } });
    if (!homework || !(await this.homework.canSee(tenant, userId, homework))) {
      throw new NotFoundException({ message: 'Homework not found', code: HOMEWORK_ERRORS.NOT_FOUND });
    }
    return homework;
  }

  private async checkFiles(organizationId: string, userId: string, fileIds: string[]): Promise<void> {
    const count = await this.dataSource.getRepository(FileObjectEntity).count({
      where: {
        id: In(fileIds),
        organization_id: organizationId,
        owner_id: userId,
        purpose: FilePurposeEnum.HOMEWORK,
        status: Not(FileStatusEnum.FAILED),
        deleted_at: IsNull(),
      },
    });
    if (count !== fileIds.length) throw new BadRequestException({ message: 'Upload the files again', code: HOMEWORK_ERRORS.FILE_INVALID });
  }

  private empty(): never {
    throw new BadRequestException({ message: 'Add your work before handing it in', code: HOMEWORK_ERRORS.SUBMISSION_EMPTY });
  }
}

/** Hand-ins allowed: the first plus the organisation's resubmissions, and one more per return for redo. */
const allowedCount = (rows: HomeworkSubmissionEntity[], settings: HomeworkSettings) =>
  1 + settings.resubmissions + rows.filter((r) => r.status === SubmissionStatusEnum.RETURNED).length;

const view = (row: HomeworkSubmissionEntity): SubmissionView => ({
  id: row.id,
  version: row.version,
  text_answer: row.text_answer,
  submitted_at: row.submitted_at,
  is_late: row.is_late,
  late_minutes: row.late_minutes,
  status: row.status,
  files: [...(row.files ?? [])]
    .sort((a, b) => a.page_order - b.page_order)
    .map((f) => ({
      id: f.file_id,
      name: f.file?.original_name ?? null,
      mime: f.file?.mime ?? null,
      size_bytes: f.file?.size_bytes == null ? null : Number(f.file.size_bytes),
      url: `/files/${f.file_id}/content`,
    })),
});
