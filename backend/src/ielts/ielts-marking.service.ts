import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AUDIT_ACTIONS } from 'src/audit/audit-actions';
import { AuditService } from 'src/audit/audit.service';
import { Tenant } from 'src/common/tenancy/tenant-context';
import { OrganizationMemberRoleEnum } from 'src/organizations/enums/organization-member-role.enum';
import { isBand, roundBand, writingBand } from './bands';
import { ListIeltsMarkingQueryDto, MarkIeltsWritingDto } from './dto/ielts-marking.dto';
import { IeltsAnswerEntity } from './entities/ielts-answer.entity';
import { IeltsAttemptEntity, IeltsAttemptStatusEnum } from './entities/ielts-attempt.entity';
import { IeltsModuleEnum, IeltsTestTypeEnum } from './entities/ielts-profile.entity';
import { IeltsTestEntity } from './entities/ielts-test.entity';
import { IeltsAttemptsService } from './ielts-attempts.service';
import { IELTS_ERRORS } from './ielts-errors';
import { IeltsProfilesService } from './ielts-profiles.service';
import { IeltsTestsService } from './ielts-tests.service';
import { wordCount } from './question-groups';

/** The four official Writing criteria; Task 1 is judged on Task Achievement, Task 2 on Task Response. */
export const WRITING_CRITERIA: Record<1 | 2, readonly string[]> = { 1: ['TA', 'CC', 'LR', 'GRA'], 2: ['TR', 'CC', 'LR', 'GRA'] };

/** Words Task 1 and Task 2 ask for; fewer is shown, not blocked. */
export const MIN_WORDS: Record<number, number> = { 1: 150, 2: 250 };

export interface IeltsTaskMarks {
  part_id: string;
  part_no: number;
  criteria: Record<string, number>;
  band: number;
  comment: string | null;
}

export interface IeltsMarkingRow {
  attempt_id: string;
  module: IeltsModuleEnum;
  status: IeltsAttemptStatusEnum;
  student: { id: string; full_name: string };
  test: { id: string; title: string };
  batch: string;
  submitted_at: Date | null;
  band: number | null;
}

export interface IeltsMarkingView extends IeltsMarkingRow {
  test_type: IeltsTestTypeEnum;
  tasks: { part_id: string; part_no: number; title: string | null; content: string | null; image_file_id: string | null; script: string; words: number; min_words: number }[];
  marks: IeltsTaskMarks[];
  feedback: string | null;
  marked_by: string | null;
  marked_at: Date | null;
}

/**
 * Marking Writing (IEL-06) for the centre's staff: what is waiting, each script with its word
 * count beside the task, and bands for the four criteria per task with comments. A task's band is
 * its criteria averaged to the nearest half band; the Writing band counts Task 2 double. Marks can
 * be changed later (audited).
 */
@Injectable()
export class IeltsMarkingService {
  constructor(
    @InjectRepository(IeltsAttemptEntity) private readonly attempts: Repository<IeltsAttemptEntity>,
    private readonly dataSource: DataSource,
    private readonly profiles: IeltsProfilesService,
    private readonly tests: IeltsTestsService,
    private readonly attemptsService: IeltsAttemptsService,
    private readonly audit: AuditService,
  ) {}

  /** Staff: handed-in Writing (or Speaking later) waiting for marks, or already marked; oldest first. */
  async list(tenant: Tenant, query: ListIeltsMarkingQueryDto): Promise<IeltsMarkingRow[]> {
    await this.assertStaff(tenant);
    await this.attemptsService.finishExpired({ organizationId: tenant.organizationId });
    const rows: (IeltsMarkingRow & { student_id: string; full_name: string; test_id: string; title: string })[] = await this.dataSource.query(
      `SELECT a.id AS attempt_id, a.module, a.status, a.submitted_at, a.band::float AS band, a.student_id, u.full_name, a.test_id, t.title,
              trim(concat(c.class_name, ' ', s.name)) AS batch
         FROM ielts_attempts a
         JOIN users u ON u.id = a.student_id
         JOIN ielts_tests t ON t.id = a.test_id
         JOIN ielts_assignments g ON g.id = a.assignment_id
         JOIN sections s ON s.id = g.section_id
         JOIN classes c ON c.id = s.class_id
        WHERE a.organization_id = $1 AND a.module = $2 AND a.status = $3
        ORDER BY a.submitted_at ASC`,
      [tenant.organizationId, query.module ?? IeltsModuleEnum.WRITING, query.state === 'MARKED' ? IeltsAttemptStatusEnum.MARKED : IeltsAttemptStatusEnum.SUBMITTED],
    );
    return rows.map((r) => ({
      attempt_id: r.attempt_id,
      module: r.module,
      status: r.status,
      student: { id: r.student_id, full_name: r.full_name },
      test: { id: r.test_id, title: r.title },
      batch: r.batch,
      submitted_at: r.submitted_at,
      band: r.band,
    }));
  }

  /** Staff: one handed-in Writing attempt with its tasks, scripts and marks. */
  async get(tenant: Tenant, attemptId: string): Promise<IeltsMarkingView> {
    await this.assertStaff(tenant);
    const attempt = await this.find(tenant, attemptId);
    return this.view(attempt);
  }

  /** Staff: bands for the four criteria per task (all tasks of the attempt), comments and feedback. */
  async markWriting(tenant: Tenant, userId: string, attemptId: string, dto: MarkIeltsWritingDto): Promise<IeltsMarkingView> {
    await this.assertStaff(tenant);
    const attempt = await this.find(tenant, attemptId);
    if (attempt.module !== IeltsModuleEnum.WRITING) this.invalid('Only Writing is marked here');
    const tasks = await this.tests.tree(attempt.test_id, IeltsModuleEnum.WRITING);
    if (dto.tasks.length !== tasks.length || !tasks.every((task) => dto.tasks.filter((m) => m.part_id === task.id).length === 1)) {
      this.invalid('Mark every task of the attempt once');
    }
    const marks: IeltsTaskMarks[] = tasks.map((task) => {
      const given = dto.tasks.find((m) => m.part_id === task.id) as MarkIeltsWritingDto['tasks'][number];
      const keys = WRITING_CRITERIA[task.part_no as 1 | 2];
      const criteria = given.criteria ?? {};
      if (Object.keys(criteria).length !== keys.length || !keys.every((k) => isBand(criteria[k]))) {
        this.invalid(`Task ${task.part_no}: give ${keys.join(', ')}, each 0 to 9 in half bands`);
      }
      const band = roundBand(keys.reduce((sum, k) => sum + criteria[k], 0) / keys.length);
      return { part_id: task.id, part_no: task.part_no, criteria: Object.fromEntries(keys.map((k) => [k, criteria[k]])), band, comment: given.comment?.trim() || null };
    });
    const t1 = marks.find((m) => m.part_no === 1);
    const t2 = marks.find((m) => m.part_no === 2);
    const band = t1 && t2 ? writingBand(t1.band, t2.band) : (t1 ?? t2 as IeltsTaskMarks).band;
    const before = { status: attempt.status, band: attempt.band === null ? null : Number(attempt.band), criteria: attempt.criteria };
    await this.attempts.update(
      { id: attempt.id },
      {
        status: IeltsAttemptStatusEnum.MARKED,
        band: band.toFixed(1),
        criteria: { tasks: marks },
        feedback: dto.feedback?.trim() || null,
        marked_by: userId,
        marked_at: new Date(),
      },
    );
    this.audit.record({
      action: AUDIT_ACTIONS.IELTS_MARK,
      organizationId: tenant.organizationId,
      actorId: userId,
      entityType: 'ielts_attempt',
      entityId: attempt.id,
      before,
      after: { status: IeltsAttemptStatusEnum.MARKED, band, criteria: { tasks: marks } },
    });
    return this.view(await this.attempts.findOneOrFail({ where: { id: attempt.id } }));
  }

  // ------------------------------------------------------------------ helpers

  private async assertStaff(tenant: Tenant): Promise<void> {
    if (tenant.memberRole === OrganizationMemberRoleEnum.STUDENT || tenant.viaEnrolment) {
      throw new ForbiddenException({ message: 'Only staff can do this', code: IELTS_ERRORS.STAFF_ONLY });
    }
    await this.profiles.assertIeltsCentre(tenant);
  }

  private async find(tenant: Tenant, attemptId: string): Promise<IeltsAttemptEntity> {
    const attempt = await this.attempts.findOne({ where: { id: attemptId, organization_id: tenant.organizationId } });
    if (!attempt) throw new NotFoundException({ message: 'Attempt not found', code: IELTS_ERRORS.ATTEMPT_NOT_FOUND });
    if (attempt.status === IeltsAttemptStatusEnum.IN_PROGRESS) {
      throw new ConflictException({ message: 'The student has not handed this in yet', code: IELTS_ERRORS.NOT_HANDED_IN });
    }
    return attempt;
  }

  private async view(attempt: IeltsAttemptEntity): Promise<IeltsMarkingView> {
    const test = await this.dataSource.getRepository(IeltsTestEntity).findOneOrFail({ where: { id: attempt.test_id } });
    const [info]: { full_name: string; batch: string }[] = await this.dataSource.query(
      `SELECT u.full_name, trim(concat(c.class_name, ' ', s.name)) AS batch
         FROM users u, ielts_assignments g JOIN sections s ON s.id = g.section_id JOIN classes c ON c.id = s.class_id
        WHERE u.id = $1 AND g.id = $2`,
      [attempt.student_id, attempt.assignment_id],
    );
    const parts = await this.tests.tree(attempt.test_id, attempt.module);
    const scripts = await this.dataSource.getRepository(IeltsAnswerEntity).find({ where: { attempt_id: attempt.id } });
    const criteria = (attempt.criteria ?? {}) as { tasks?: IeltsTaskMarks[] };
    return {
      attempt_id: attempt.id,
      module: attempt.module,
      status: attempt.status,
      student: { id: attempt.student_id, full_name: info?.full_name ?? '' },
      test: { id: test.id, title: test.title },
      test_type: test.test_type,
      batch: info?.batch ?? '',
      submitted_at: attempt.submitted_at,
      band: attempt.band === null ? null : Number(attempt.band),
      tasks: parts.map((p) => {
        const script = scripts.find((s) => s.part_id === p.id && !s.question_id)?.answer ?? '';
        return { part_id: p.id, part_no: p.part_no, title: p.title, content: p.content, image_file_id: p.image_file_id, script, words: wordCount(script), min_words: MIN_WORDS[p.part_no] ?? 0 };
      }),
      marks: criteria.tasks ?? [],
      feedback: attempt.feedback,
      marked_by: attempt.marked_by,
      marked_at: attempt.marked_at,
    };
  }

  private invalid(message: string): never {
    throw new BadRequestException({ message, code: IELTS_ERRORS.MARKS_INVALID });
  }
}
