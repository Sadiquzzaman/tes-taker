import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, LessThan, Repository } from 'typeorm';
import { Tenant } from 'src/common/tenancy/tenant-context';
import { IeltsAnswerInputDto } from './dto/ielts-attempt.dto';
import { IeltsAnswerEntity } from './entities/ielts-answer.entity';
import { IeltsAssignmentEntity } from './entities/ielts-assignment.entity';
import { IeltsAttemptEntity, IeltsAttemptStatusEnum } from './entities/ielts-attempt.entity';
import { IeltsModuleEnum, IeltsTestTypeEnum } from './entities/ielts-profile.entity';
import { IeltsGroupShared, IeltsOption } from './entities/ielts-question-group.entity';
import { IeltsAnswerKey } from './entities/ielts-question.entity';
import { IeltsTestEntity, IeltsTestPurposeEnum, IeltsTestStatusEnum } from './entities/ielts-test.entity';
import { IeltsBandTablesService } from './ielts-band-tables.service';
import { IELTS_ERRORS } from './ielts-errors';
import { IeltsProfilesService } from './ielts-profiles.service';
import { LISTENING_REVIEW_SECONDS } from './ielts-templates';
import { IeltsPartView, IeltsTestsService } from './ielts-tests.service';
import { numbersTaken } from './question-groups';
import { marksFor } from './scoring';
import { scaledRaw } from './bands';

/** What a Listening / Reading score is out of; null for Writing and Speaking. */
export const totalOf = (totals: Map<string, number>, a: { test_id: string; module: string }): number | null =>
  a.module === IeltsModuleEnum.LISTENING || a.module === IeltsModuleEnum.READING ? (totals.get(`${a.test_id}:${a.module}`) ?? null) : null;

/** Answers sent this long after the time runs out still count (a slow network at the end). */
export const GRACE_SECONDS = 30;

/** Modules a student starts; Speaking started by a student is practice recordings (a live session is started by the examiner). */
const ON_SCREEN: readonly IeltsModuleEnum[] = [IeltsModuleEnum.LISTENING, IeltsModuleEnum.READING, IeltsModuleEnum.WRITING, IeltsModuleEnum.SPEAKING];

/** Speaking practice: extra time on top of the module's to record and send each part. */
const SPEAKING_EXTRA_SECONDS = 10 * 60;

export enum IeltsSpeakingModeEnum {
  LIVE = 'LIVE',
  RECORDED = 'RECORDED',
}

/** A Writing script's longest length (about 3000 words), and a question answer's. */
export const SCRIPT_MAX = 20_000;
const ANSWER_MAX = 500;

/** A mock's modules run in this order on the computer; Speaking is separate. */
const MOCK_SEQUENCE: readonly IeltsModuleEnum[] = [IeltsModuleEnum.LISTENING, IeltsModuleEnum.READING, IeltsModuleEnum.WRITING];

export interface IeltsMyAttempt {
  id: string;
  status: IeltsAttemptStatusEnum;
  /** Speaking: LIVE (with the teacher) or RECORDED (practice). */
  mode: string | null;
  deadline: Date;
  raw_score: number | null;
  /** Listening / Reading: what the score is out of (40 in a full test). */
  raw_total: number | null;
  band: number | null;
}

export interface IeltsMyAssignment {
  id: string;
  test: { id: string; title: string; purpose: IeltsTestPurposeEnum; test_type: IeltsTestTypeEnum; modules: IeltsModuleEnum[]; durations: Partial<Record<IeltsModuleEnum, number>> };
  opens_at: Date;
  closes_at: Date;
  is_open: boolean;
  attempts: Partial<Record<IeltsModuleEnum, IeltsMyAttempt>>;
}

/** The paper as a student sees it: no answers. */
export interface IeltsPaperPart {
  id: string;
  module: IeltsModuleEnum;
  part_no: number;
  title: string | null;
  content: string | null;
  audio_file_id: string | null;
  image_file_id: string | null;
  groups: {
    id: string;
    type: string;
    instruction: string;
    word_limit: number | null;
    shared: IeltsGroupShared | null;
    image_file_id: string | null;
    number_from: number | null;
    number_to: number | null;
    questions: {
      id: string;
      number_from: number;
      number_to: number;
      prompt: string | null;
      options: IeltsOption[] | null;
      /** After hand-in, when answers may be shown. */
      key?: IeltsAnswerKey;
      marks?: number;
    }[];
  }[];
}

export interface IeltsAttemptView {
  attempt: {
    id: string;
    assignment_id: string;
    module: IeltsModuleEnum;
    status: IeltsAttemptStatusEnum;
    started_at: Date;
    deadline: Date;
    submitted_at: Date | null;
    raw_score: number | null;
    /** Listening / Reading: what the score is out of (40 in a full test). */
    raw_total: number | null;
    band: number | null;
    /** Writing: bands per task and criterion, with comments; Speaking: the four criteria; once marked. */
    criteria: Record<string, unknown> | null;
    /** Speaking: LIVE or RECORDED. */
    mode: string | null;
    /** Speaking: part id → recording file id. */
    recordings: Record<string, string>;
    feedback: string | null;
    /** The server's clock, so the screen's timer does not trust the device's. */
    now: Date;
    review_seconds: number;
  };
  test: { id: string; title: string; test_type: IeltsTestTypeEnum; purpose: IeltsTestPurposeEnum };
  /** While in progress, and after hand-in when answers may be shown (practice sets, or once the window closed); otherwise null. */
  parts: IeltsPaperPart[] | null;
  /** question_id → what the student answered. */
  answers: Record<string, string>;
}

/**
 * Students taking IELTS tests opened for their batch (IEL-04, IEL-05): start or resume a module
 * with its own timer, answers saved as they go, hand in to have Listening and Reading marked out
 * of 40 and turned into a band through the centre's tables. Time that runs out hands the module
 * in. A mock runs Listening, Reading, Writing in order. Right answers are shown after hand-in for
 * practice sets, and for mocks once the window has closed.
 */
@Injectable()
export class IeltsAttemptsService {
  constructor(
    @InjectRepository(IeltsAttemptEntity) private readonly attempts: Repository<IeltsAttemptEntity>,
    private readonly dataSource: DataSource,
    private readonly profiles: IeltsProfilesService,
    private readonly tests: IeltsTestsService,
    private readonly bandTables: IeltsBandTablesService,
  ) {}

  /** A student's openings (their active batches), newest first, with their attempts per module. */
  async listMine(tenant: Tenant, userId: string): Promise<IeltsMyAssignment[]> {
    await this.profiles.assertIeltsCentre(tenant);
    await this.finishExpired({ studentId: userId });
    const rows: (IeltsAssignmentEntity & { title: string; purpose: IeltsTestPurposeEnum; test_type: IeltsTestTypeEnum; modules: IeltsModuleEnum[]; durations: Partial<Record<IeltsModuleEnum, number>> })[] =
      await this.dataSource.query(
        `SELECT a.*, t.title, t.purpose, t.test_type, t.modules, t.durations
           FROM ielts_assignments a
           JOIN ielts_tests t ON t.id = a.test_id AND t.deleted_at IS NULL AND t.status <> 'DRAFT'
          WHERE a.organization_id = $1 AND a.deleted_at IS NULL
            AND EXISTS (SELECT 1 FROM enrolments e WHERE e.section_id = a.section_id AND e.student_id = $2 AND e.status = 'ACTIVE')
          ORDER BY a.opens_at DESC`,
        [tenant.organizationId, userId],
      );
    if (!rows.length) return [];
    const mine = await this.attempts.find({ where: { student_id: userId, assignment_id: In(rows.map((r) => r.id)) } });
    const now = new Date();
    const totals = await this.tests.numberTotals(rows.map((r) => r.test_id));
    return rows.map((r) => ({
      id: r.id,
      test: { id: r.test_id, title: r.title, purpose: r.purpose, test_type: r.test_type, modules: r.modules, durations: r.durations },
      opens_at: r.opens_at,
      closes_at: r.closes_at,
      is_open: r.opens_at <= now && now <= r.closes_at,
      attempts: Object.fromEntries(
        mine
          .filter((a) => a.assignment_id === r.id)
          .map((a) => [
            a.module,
            { id: a.id, status: a.status, mode: a.mode, deadline: a.deadline, raw_score: a.raw_score, raw_total: totalOf(totals, a), band: a.band === null ? null : Number(a.band) },
          ]),
      ),
    }));
  }

  /** Starts a module (or resumes it while its time lasts). */
  async start(tenant: Tenant, userId: string, assignmentId: string, module: IeltsModuleEnum): Promise<IeltsAttemptView> {
    await this.profiles.assertIeltsCentre(tenant);
    const assignment = await this.myAssignment(tenant, userId, assignmentId);
    const test = await this.dataSource.getRepository(IeltsTestEntity).findOneOrFail({ where: { id: assignment.test_id } });
    if (!test.modules.includes(module)) throw new BadRequestException({ message: 'This test does not have that module', code: IELTS_ERRORS.MODULE_NOT_READY });
    if (!ON_SCREEN.includes(module)) throw new BadRequestException({ message: 'This module is not taken on screen yet', code: IELTS_ERRORS.MODULE_NOT_READY });

    const existing = await this.attempts.findOne({ where: { assignment_id: assignment.id, student_id: userId, module } });
    if (existing) {
      if (existing.mode === IeltsSpeakingModeEnum.LIVE) {
        throw new ConflictException({ message: 'Your teacher runs this Speaking session', code: IELTS_ERRORS.ATTEMPT_DONE });
      }
      if (existing.status === IeltsAttemptStatusEnum.IN_PROGRESS && !this.expired(existing)) return this.view(existing, test, assignment);
      await this.finish(existing.id);
      throw new ConflictException({ message: 'You have handed in this module', code: IELTS_ERRORS.ATTEMPT_DONE });
    }
    const now = new Date();
    if (now < assignment.opens_at || now > assignment.closes_at) throw new ForbiddenException({ message: 'This test is not open now', code: IELTS_ERRORS.NOT_OPEN });
    if (test.purpose === IeltsTestPurposeEnum.MOCK && MOCK_SEQUENCE.includes(module)) {
      const before = MOCK_SEQUENCE.slice(0, MOCK_SEQUENCE.indexOf(module)).filter((m) => test.modules.includes(m));
      const done = await this.attempts.count({ where: { assignment_id: assignment.id, student_id: userId, module: In(before), status: In([IeltsAttemptStatusEnum.SUBMITTED, IeltsAttemptStatusEnum.MARKED]) } });
      if (done < before.length) throw new ConflictException({ message: 'A mock runs Listening, Reading, then Writing', code: IELTS_ERRORS.MODULE_ORDER });
    }
    const seconds =
      (test.durations[module] ?? 0) + (module === IeltsModuleEnum.LISTENING ? LISTENING_REVIEW_SECONDS : 0) + (module === IeltsModuleEnum.SPEAKING ? SPEAKING_EXTRA_SECONDS : 0);
    try {
      const attempt = await this.attempts.save(
        this.attempts.create({
          organization_id: tenant.organizationId,
          test_id: test.id,
          assignment_id: assignment.id,
          student_id: userId,
          module,
          mode: module === IeltsModuleEnum.SPEAKING ? IeltsSpeakingModeEnum.RECORDED : null,
          status: IeltsAttemptStatusEnum.IN_PROGRESS,
          started_at: now,
          deadline: new Date(now.getTime() + seconds * 1000),
        }),
      );
      return this.view(attempt, test, assignment);
    } catch (error) {
      // Two starts at once: the other one won; resume it.
      const other = await this.attempts.findOne({ where: { assignment_id: assignment.id, student_id: userId, module } });
      if (!other) throw error;
      return this.view(other, test, assignment);
    }
  }

  /** The paper (in progress) or the result (handed in). */
  async get(tenant: Tenant, userId: string, attemptId: string): Promise<IeltsAttemptView> {
    await this.profiles.assertIeltsCentre(tenant);
    let attempt = await this.mine(tenant, userId, attemptId);
    if (attempt.status === IeltsAttemptStatusEnum.IN_PROGRESS && this.expired(attempt)) attempt = await this.finish(attempt.id);
    return this.view(attempt);
  }

  /** Saves answers while the module's time lasts (an empty answer clears it). */
  async save(tenant: Tenant, userId: string, attemptId: string, answers: IeltsAnswerInputDto[]): Promise<{ saved: number; deadline: Date }> {
    await this.profiles.assertIeltsCentre(tenant);
    const attempt = await this.mine(tenant, userId, attemptId);
    if (attempt.status !== IeltsAttemptStatusEnum.IN_PROGRESS || this.expired(attempt)) {
      throw new ConflictException({ message: 'You have handed in this module', code: IELTS_ERRORS.ATTEMPT_DONE });
    }
    await this.write(attempt, answers);
    return { saved: answers.length, deadline: attempt.deadline };
  }

  /** Hands a module in (with its last answers) and marks it. */
  async submit(tenant: Tenant, userId: string, attemptId: string, answers: IeltsAnswerInputDto[] = []): Promise<IeltsAttemptView> {
    await this.profiles.assertIeltsCentre(tenant);
    const attempt = await this.mine(tenant, userId, attemptId);
    if (attempt.status === IeltsAttemptStatusEnum.IN_PROGRESS && !this.expired(attempt) && answers.length) await this.write(attempt, answers);
    return this.view(await this.finish(attempt.id));
  }

  /** Speaking practice: the student's recording of one part (an IELTS audio upload of their own). */
  async record(tenant: Tenant, userId: string, attemptId: string, partId: string, fileId: string | null): Promise<IeltsAttemptView> {
    await this.profiles.assertIeltsCentre(tenant);
    const attempt = await this.mine(tenant, userId, attemptId);
    if (attempt.module !== IeltsModuleEnum.SPEAKING || attempt.mode !== IeltsSpeakingModeEnum.RECORDED) {
      throw new BadRequestException({ message: 'Only Speaking practice has your recordings', code: IELTS_ERRORS.ANSWER_INVALID });
    }
    if (attempt.status !== IeltsAttemptStatusEnum.IN_PROGRESS || this.expired(attempt)) {
      throw new ConflictException({ message: 'You have handed in this module', code: IELTS_ERRORS.ATTEMPT_DONE });
    }
    await this.setRecording(tenant, attempt, partId, fileId, userId);
    return this.view(await this.attempts.findOneOrFail({ where: { id: attempt.id } }));
  }

  /**
   * Keeps a part's recording on a Speaking attempt: an audio file uploaded for IELTS in the centre
   * (by `ownerId` when given). Null removes it.
   */
  async setRecording(tenant: Tenant, attempt: IeltsAttemptEntity, partId: string, fileId: string | null, ownerId?: string): Promise<void> {
    const parts = await this.tests.tree(attempt.test_id, IeltsModuleEnum.SPEAKING);
    if (!parts.some((p) => p.id === partId)) throw new BadRequestException({ message: 'That part is not in this Speaking test', code: IELTS_ERRORS.ANSWER_INVALID });
    if (fileId) {
      const [file] = await this.dataSource.query(
        `SELECT id FROM file_objects WHERE id = $1 AND organization_id = $2 AND purpose = 'IELTS' AND mime LIKE 'audio/%' AND status <> 'FAILED' AND deleted_at IS NULL AND ($3::uuid IS NULL OR owner_id = $3)`,
        [fileId, tenant.organizationId, ownerId ?? null],
      );
      if (!file) throw new BadRequestException({ message: 'Upload the recording for IELTS first', code: IELTS_ERRORS.FILE_INVALID });
    }
    const recordings = { ...(attempt.recording_file_ids ?? {}) };
    if (fileId) recordings[partId] = fileId;
    else delete recordings[partId];
    await this.attempts.update({ id: attempt.id }, { recording_file_ids: recordings });
    attempt.recording_file_ids = recordings;
  }

  /** Hands in attempts whose time ran out (a student's, or one opening's). */
  async finishExpired(filter: { studentId?: string; assignmentId?: string; organizationId?: string }): Promise<void> {
    const cutoff = new Date(Date.now() - GRACE_SECONDS * 1000);
    const expired = await this.attempts.find({
      where: {
        status: IeltsAttemptStatusEnum.IN_PROGRESS,
        deadline: LessThan(cutoff),
        ...(filter.studentId ? { student_id: filter.studentId } : {}),
        ...(filter.assignmentId ? { assignment_id: filter.assignmentId } : {}),
        ...(filter.organizationId ? { organization_id: filter.organizationId } : {}),
      },
    });
    for (const attempt of expired) await this.finish(attempt.id);
  }

  // ------------------------------------------------------------------ helpers

  private expired(attempt: IeltsAttemptEntity): boolean {
    return Date.now() > attempt.deadline.getTime() + GRACE_SECONDS * 1000;
  }

  /**
   * Hands an attempt in once (row locked). Listening and Reading are marked: each answer against
   * its key, the raw score (out of the test's numbers, 40 in a full test) and the band, from the
   * score scaled to 40. Writing and Speaking wait for their marks.
   */
  private async finish(attemptId: string): Promise<IeltsAttemptEntity> {
    const marked = await this.dataSource.transaction(async (manager) => {
      const [locked] = await manager.query(`SELECT id FROM ielts_attempts WHERE id = $1 AND status = 'IN_PROGRESS' FOR UPDATE`, [attemptId]);
      if (!locked) return null;
      const attempt = await manager.getRepository(IeltsAttemptEntity).findOneOrFail({ where: { id: attemptId } });
      if (attempt.module === IeltsModuleEnum.WRITING || attempt.module === IeltsModuleEnum.SPEAKING) {
        // Writing and Speaking wait for a teacher to mark them against their four criteria (IEL-06, IEL-07).
        await manager.getRepository(IeltsAttemptEntity).update({ id: attempt.id }, { status: IeltsAttemptStatusEnum.SUBMITTED, submitted_at: new Date() });
        return attempt.id;
      }
      const test = await manager.getRepository(IeltsTestEntity).findOneOrFail({ where: { id: attempt.test_id } });
      const parts = await this.tests.tree(test.id, attempt.module);
      const answers = await manager.getRepository(IeltsAnswerEntity).find({ where: { attempt_id: attempt.id } });
      const byQuestion = new Map(answers.filter((a) => a.question_id).map((a) => [a.question_id as string, a]));
      let raw = 0;
      let total = 0;
      for (const part of parts) {
        for (const group of part.groups) {
          for (const question of group.questions) {
            total += numbersTaken(group.type, question.answer);
            const row = byQuestion.get(question.id);
            if (!row) continue;
            const marks = marksFor(group.type, question.answer, group.word_limit, row.answer);
            raw += marks;
            await manager.getRepository(IeltsAnswerEntity).update({ id: row.id }, { marks, correct: marks === numbersTaken(group.type, question.answer) });
          }
        }
      }
      raw = Math.min(raw, 40);
      // A practice set with fewer questions is banded as the same share of 40.
      const band = await this.bandTables.bandFor(attempt.organization_id, attempt.module as IeltsModuleEnum.LISTENING | IeltsModuleEnum.READING, test.test_type, scaledRaw(raw, total));
      await manager.getRepository(IeltsAttemptEntity).update(
        { id: attempt.id },
        { status: IeltsAttemptStatusEnum.MARKED, submitted_at: new Date(), raw_score: raw, band: band.toFixed(1), marked_at: new Date() },
      );
      return attempt.id;
    });
    return this.attempts.findOneOrFail({ where: { id: marked ?? attemptId } });
  }

  /** Upserts answers to questions of the attempt's module, or Writing scripts per task. */
  private async write(attempt: IeltsAttemptEntity, answers: IeltsAnswerInputDto[]): Promise<void> {
    const parts = await this.tests.tree(attempt.test_id, attempt.module);
    if (attempt.module === IeltsModuleEnum.WRITING) {
      const tasks = new Set(parts.map((p) => p.id));
      if (answers.some((a) => !a.part_id || a.question_id || !tasks.has(a.part_id) || (a.answer?.length ?? 0) > SCRIPT_MAX)) {
        throw new BadRequestException({ message: 'A script is for a task not in this module, or too long', code: IELTS_ERRORS.ANSWER_INVALID });
      }
      for (const a of answers) {
        await this.dataSource.query(
          `INSERT INTO ielts_answers (attempt_id, question_id, part_id, answer, updated_at) VALUES ($1, NULL, $2, $3, now())
           ON CONFLICT (attempt_id, part_id) WHERE question_id IS NULL DO UPDATE SET answer = EXCLUDED.answer, updated_at = now()`,
          [attempt.id, a.part_id, a.answer?.trim() ? a.answer : null],
        );
      }
      return;
    }
    const partOf = new Map(parts.flatMap((p) => p.groups.flatMap((g) => g.questions.map((q) => [q.id, p.id] as const))));
    if (answers.some((a) => !a.question_id || !partOf.has(a.question_id) || (a.answer?.length ?? 0) > ANSWER_MAX)) {
      throw new BadRequestException({ message: 'An answer is for a question not in this module', code: IELTS_ERRORS.ANSWER_INVALID });
    }
    for (const a of answers) {
      await this.dataSource.query(
        `INSERT INTO ielts_answers (attempt_id, question_id, part_id, answer, updated_at) VALUES ($1, $2, $3, $4, now())
         ON CONFLICT (attempt_id, question_id) WHERE question_id IS NOT NULL DO UPDATE SET answer = EXCLUDED.answer, updated_at = now()`,
        [attempt.id, a.question_id, partOf.get(a.question_id as string), a.answer?.trim() ? a.answer.trim() : null],
      );
    }
  }

  private async myAssignment(tenant: Tenant, userId: string, assignmentId: string): Promise<IeltsAssignmentEntity> {
    const [row] = await this.dataSource.query(
      `SELECT a.id FROM ielts_assignments a
         JOIN ielts_tests t ON t.id = a.test_id AND t.deleted_at IS NULL AND t.status = $4
        WHERE a.id = $1 AND a.organization_id = $2 AND a.deleted_at IS NULL
          AND EXISTS (SELECT 1 FROM enrolments e WHERE e.section_id = a.section_id AND e.student_id = $3 AND e.status = 'ACTIVE')`,
      [assignmentId, tenant.organizationId, userId, IeltsTestStatusEnum.PUBLISHED],
    );
    if (!row) throw new NotFoundException({ message: 'Test not found', code: IELTS_ERRORS.ASSIGNMENT_NOT_FOUND });
    return this.dataSource.getRepository(IeltsAssignmentEntity).findOneOrFail({ where: { id: row.id, deleted_at: IsNull() } });
  }

  private async mine(tenant: Tenant, userId: string, attemptId: string): Promise<IeltsAttemptEntity> {
    const attempt = await this.attempts.findOne({ where: { id: attemptId, student_id: userId, organization_id: tenant.organizationId } });
    if (!attempt) throw new NotFoundException({ message: 'Attempt not found', code: IELTS_ERRORS.ATTEMPT_NOT_FOUND });
    return attempt;
  }

  private async view(attempt: IeltsAttemptEntity, test?: IeltsTestEntity, assignment?: IeltsAssignmentEntity): Promise<IeltsAttemptView> {
    const t = test ?? (await this.dataSource.getRepository(IeltsTestEntity).findOneOrFail({ where: { id: attempt.test_id } }));
    const a = assignment ?? (await this.dataSource.getRepository(IeltsAssignmentEntity).findOneOrFail({ where: { id: attempt.assignment_id } }));
    const inProgress = attempt.status === IeltsAttemptStatusEnum.IN_PROGRESS;
    // Writing and Speaking have no right answers to hide: the tasks show after hand-in.
    const review = !inProgress && (attempt.module === IeltsModuleEnum.WRITING || attempt.module === IeltsModuleEnum.SPEAKING || t.purpose === IeltsTestPurposeEnum.PRACTICE || Date.now() > a.closes_at.getTime());
    const marked = attempt.status === IeltsAttemptStatusEnum.MARKED;
    const rows = await this.dataSource.getRepository(IeltsAnswerEntity).find({ where: { attempt_id: attempt.id } });
    const marks = new Map(rows.filter((r) => r.question_id).map((r) => [r.question_id as string, r.marks]));
    return {
      attempt: {
        id: attempt.id,
        assignment_id: attempt.assignment_id,
        module: attempt.module,
        status: attempt.status,
        started_at: attempt.started_at,
        deadline: attempt.deadline,
        submitted_at: attempt.submitted_at,
        raw_score: attempt.raw_score,
        raw_total: totalOf(await this.tests.numberTotals([attempt.test_id]), attempt),
        band: attempt.band === null ? null : Number(attempt.band),
        criteria: marked ? attempt.criteria : null,
        mode: attempt.mode,
        recordings: attempt.recording_file_ids ?? {},
        feedback: marked ? attempt.feedback : null,
        now: new Date(),
        review_seconds: attempt.module === IeltsModuleEnum.LISTENING ? LISTENING_REVIEW_SECONDS : 0,
      },
      test: { id: t.id, title: t.title, test_type: t.test_type, purpose: t.purpose },
      parts: inProgress || review ? this.paper(await this.tests.tree(t.id, attempt.module), review ? marks : null) : null,
      // Question answers by question id; Writing scripts by task (part) id.
      answers: Object.fromEntries(rows.filter((r) => r.answer !== null).map((r) => [r.question_id ?? r.part_id, r.answer as string])),
    };
  }

  /** The parts without answers; with keys and marks when the result may be reviewed. */
  private paper(parts: IeltsPartView[], marks: Map<string, number> | null): IeltsPaperPart[] {
    return parts.map((p) => ({
      id: p.id,
      module: p.module,
      part_no: p.part_no,
      title: p.title,
      content: p.content,
      audio_file_id: p.audio_file_id,
      image_file_id: p.image_file_id,
      groups: p.groups.map((g) => ({
        id: g.id,
        type: g.type,
        instruction: g.instruction,
        word_limit: g.word_limit,
        shared: g.shared,
        image_file_id: g.image_file_id,
        number_from: g.number_from,
        number_to: g.number_to,
        questions: g.questions.map((q) => ({
          id: q.id,
          number_from: q.number_from,
          number_to: q.number_to,
          prompt: q.prompt,
          options: q.options,
          ...(marks ? { key: q.answer, marks: marks.get(q.id) ?? 0 } : {}),
        })),
      })),
    }));
  }
}

