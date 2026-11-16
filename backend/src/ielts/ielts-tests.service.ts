import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Not, Repository } from 'typeorm';
import { AUDIT_ACTIONS } from 'src/audit/audit-actions';
import { AuditService } from 'src/audit/audit.service';
import { Tenant } from 'src/common/tenancy/tenant-context';
import { FileObjectEntity } from 'src/files/entities/file-object.entity';
import { FilePurposeEnum, FileStatusEnum, isAudioMime, isImageMime } from 'src/files/file-rules';
import { OrganizationMemberRoleEnum } from 'src/organizations/enums/organization-member-role.enum';
import { CreateIeltsTestDto, ListIeltsTestsQueryDto, UpdateIeltsTestDto, UpdateIeltsTestPartDto } from './dto/ielts-test.dto';
import { IeltsModuleEnum, IeltsTestTypeEnum } from './entities/ielts-profile.entity';
import { IeltsGroupShared, IeltsOption, IeltsQuestionGroupEntity } from './entities/ielts-question-group.entity';
import { IeltsAnswerKey, IeltsQuestionEntity } from './entities/ielts-question.entity';
import { IeltsTestEntity, IeltsTestPurposeEnum, IeltsTestStatusEnum } from './entities/ielts-test.entity';
import { IeltsTestPartEntity } from './entities/ielts-test-part.entity';
import { IELTS_ERRORS } from './ielts-errors';
import { IeltsProfilesService } from './ielts-profiles.service';
import { MAX_MODULE_SECONDS, MIN_MODULE_SECONDS, MOCK_DURATIONS, MODULE_ORDER, PART_COUNT, practiceDuration, sortModules } from './ielts-templates';
import { MODULE_NUMBERS, numbersTaken } from './question-groups';

export interface IeltsTestSummary {
  id: string;
  title: string;
  test_type: IeltsTestTypeEnum;
  purpose: IeltsTestPurposeEnum;
  modules: IeltsModuleEnum[];
  durations: Partial<Record<IeltsModuleEnum, number>>;
  status: IeltsTestStatusEnum;
  needs_review: boolean;
  created_by: { id: string; full_name: string };
  updated_at: Date;
  /** Question numbers used per module (a mock's Listening and Reading need 40). */
  question_counts: Partial<Record<IeltsModuleEnum, number>>;
}

export interface IeltsQuestionView {
  id: string;
  sort_order: number;
  /** Its number(s) in the module, 1–40 ("Choose TWO letters" takes two). */
  number_from: number;
  number_to: number;
  prompt: string | null;
  options: IeltsOption[] | null;
  answer: IeltsAnswerKey;
}

export interface IeltsGroupView {
  id: string;
  type: string;
  instruction: string;
  word_limit: number | null;
  shared: IeltsGroupShared | null;
  image_file_id: string | null;
  sort_order: number;
  /** "Questions 1–5"; null for a group without questions. */
  number_from: number | null;
  number_to: number | null;
  questions: IeltsQuestionView[];
}

export interface IeltsPartView {
  id: string;
  module: IeltsModuleEnum;
  part_no: number;
  title: string | null;
  content: string | null;
  audio_file_id: string | null;
  image_file_id: string | null;
  groups: IeltsGroupView[];
}

export interface IeltsTestView extends Omit<IeltsTestSummary, 'question_counts'> {
  /** The person asking can change it (the maker, an owner or an admin). */
  can_edit: boolean;
  parts: IeltsPartView[];
}

const MANAGERS = [OrganizationMemberRoleEnum.OWNER, OrganizationMemberRoleEnum.ADMIN];

/** What stops a test being published, per part (or the whole module for NOT_40). */
export interface IeltsTestProblem {
  module: IeltsModuleEnum;
  part_no: number | null;
  problem: 'NO_RECORDING' | 'NO_TEXT' | 'NO_QUESTIONS' | 'NO_PICTURE' | 'NOT_40';
  /** NOT_40: the numbers used so far. */
  count?: number;
}

/**
 * IELTS tests (IEL-03): a mock gets every part of the modules it includes (the real template);
 * a practice set gets the chosen parts of one module. Staff of the centre see every test; the
 * maker, owners and admins change it, and only while it is a draft. Deleting keeps the row.
 * Question groups and questions are built through IeltsGroupsService; publishing checks the test
 * is complete.
 */
@Injectable()
export class IeltsTestsService {
  constructor(
    @InjectRepository(IeltsTestEntity) private readonly tests: Repository<IeltsTestEntity>,
    @InjectRepository(IeltsTestPartEntity) private readonly parts: Repository<IeltsTestPartEntity>,
    private readonly dataSource: DataSource,
    private readonly profiles: IeltsProfilesService,
    private readonly audit: AuditService,
  ) {}

  async create(tenant: Tenant, userId: string, dto: CreateIeltsTestDto): Promise<IeltsTestView> {
    await this.assertStaff(tenant);
    const layout = this.layout(dto);
    const id = await this.dataSource.transaction(async (manager) => {
      const test = await manager.getRepository(IeltsTestEntity).save(
        manager.getRepository(IeltsTestEntity).create({
          organization_id: tenant.organizationId,
          title: dto.title.trim(),
          test_type: dto.test_type,
          purpose: dto.purpose,
          modules: layout.modules,
          durations: layout.durations,
          status: IeltsTestStatusEnum.DRAFT,
          created_by: userId,
        }),
      );
      await manager.getRepository(IeltsTestPartEntity).save(layout.parts.map((p) => manager.getRepository(IeltsTestPartEntity).create({ test_id: test.id, ...p })));
      return test.id;
    });
    return this.get(tenant, userId, id);
  }

  /** Staff: the centre's tests (not deleted), newest first. */
  async list(tenant: Tenant, query: ListIeltsTestsQueryDto): Promise<IeltsTestSummary[]> {
    await this.assertStaff(tenant);
    const rows = await this.tests.find({
      where: { organization_id: tenant.organizationId, deleted_at: IsNull(), ...(query.status ? { status: query.status } : {}), ...(query.purpose ? { purpose: query.purpose } : {}) },
      order: { updated_at: 'DESC' },
    });
    if (!rows.length) return [];
    const counts: { test_id: string; module: IeltsModuleEnum; n: number }[] = await this.dataSource.query(
      `SELECT p.test_id, p.module, SUM(CASE WHEN g.type = 'MCQ_MULTI' THEN jsonb_array_length(q.answer->'keys') ELSE 1 END)::int AS n
         FROM ielts_test_parts p
         JOIN ielts_question_groups g ON g.part_id = p.id AND g.deleted_at IS NULL
         JOIN ielts_questions q ON q.group_id = g.id AND q.deleted_at IS NULL
        WHERE p.test_id = ANY($1::uuid[])
        GROUP BY p.test_id, p.module`,
      [rows.map((r) => r.id)],
    );
    const names = await this.names(rows.map((r) => r.created_by));
    return rows.map((r) => ({
      ...this.summary(r, names),
      question_counts: Object.fromEntries(counts.filter((c) => c.test_id === r.id).map((c) => [c.module, c.n])),
    }));
  }

  /** Staff: one test with its parts, groups and questions (answers included), in test order. */
  async get(tenant: Tenant, userId: string, testId: string): Promise<IeltsTestView> {
    await this.assertStaff(tenant);
    const test = await this.find(tenant, testId);
    const names = await this.names([test.created_by]);
    return {
      ...this.summary(test, names),
      can_edit: this.canEdit(tenant, userId, test),
      parts: await this.tree(test.id),
    };
  }

  /** A test's parts in test order with live groups and questions, numbered 1–40 per module. */
  async tree(testId: string, module?: IeltsModuleEnum): Promise<IeltsPartView[]> {
    const parts = await this.parts.find({ where: { test_id: testId, ...(module ? { module } : {}) } });
    parts.sort((a, b) => MODULE_ORDER.indexOf(a.module) - MODULE_ORDER.indexOf(b.module) || a.part_no - b.part_no);
    const groups = parts.length
      ? await this.dataSource.getRepository(IeltsQuestionGroupEntity).find({ where: { part_id: In(parts.map((p) => p.id)), deleted_at: IsNull() }, order: { sort_order: 'ASC' } })
      : [];
    const questions = groups.length
      ? await this.dataSource.getRepository(IeltsQuestionEntity).find({ where: { group_id: In(groups.map((g) => g.id)), deleted_at: IsNull() }, order: { sort_order: 'ASC' } })
      : [];
    const next: Partial<Record<IeltsModuleEnum, number>> = {};
    return parts.map((p) => ({
      id: p.id,
      module: p.module,
      part_no: p.part_no,
      title: p.title,
      content: p.content,
      audio_file_id: p.audio_file_id,
      image_file_id: p.image_file_id,
      groups: groups
        .filter((g) => g.part_id === p.id)
        .map((g) => {
          // Numbers run 1–40 through each module: parts in order, groups in order, questions in order.
          const numbered = questions
            .filter((q) => q.group_id === g.id)
            .map((q) => {
              const from = next[p.module] ?? 1;
              next[p.module] = from + numbersTaken(g.type, q.answer);
              return { id: q.id, sort_order: q.sort_order, number_from: from, number_to: from + numbersTaken(g.type, q.answer) - 1, prompt: q.prompt, options: q.options, answer: q.answer };
            });
          return {
            id: g.id,
            type: g.type,
            instruction: g.instruction,
            word_limit: g.word_limit,
            shared: g.shared,
            image_file_id: g.image_file_id,
            sort_order: g.sort_order,
            number_from: numbered[0]?.number_from ?? null,
            number_to: numbered[numbered.length - 1]?.number_to ?? null,
            questions: numbered,
          };
        }),
    }));
  }

  /** The maker, owners and admins: the title any time; test type and times while it is a draft. */
  async update(tenant: Tenant, userId: string, testId: string, dto: UpdateIeltsTestDto): Promise<IeltsTestView> {
    const test = await this.editable(tenant, userId, testId, { draftOnly: dto.test_type !== undefined || dto.durations !== undefined });
    if (dto.durations !== undefined) {
      for (const [module, seconds] of Object.entries(dto.durations)) {
        if (!test.modules.includes(module as IeltsModuleEnum) || !Number.isInteger(seconds) || seconds < MIN_MODULE_SECONDS || seconds > MAX_MODULE_SECONDS) {
          this.invalid('Times are whole seconds from 1 minute to 3 hours, for the modules the test includes');
        }
      }
    }
    await this.tests.update(
      { id: test.id },
      {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.test_type !== undefined ? { test_type: dto.test_type } : {}),
        ...(dto.durations !== undefined ? { durations: { ...test.durations, ...dto.durations } } : {}),
        updated_at: new Date(),
      },
    );
    return this.get(tenant, userId, test.id);
  }

  /** The maker, owners and admins: delete a test (the row is kept, audited). */
  async remove(tenant: Tenant, userId: string, testId: string): Promise<void> {
    const test = await this.editable(tenant, userId, testId, { draftOnly: false });
    await this.tests.update({ id: test.id }, { deleted_at: new Date(), deleted_by: userId });
    this.audit.record({
      action: AUDIT_ACTIONS.IELTS_TEST_DELETE,
      organizationId: tenant.organizationId,
      actorId: userId,
      entityType: 'ielts_test',
      entityId: test.id,
      before: { title: test.title, purpose: test.purpose, status: test.status },
      after: null,
    });
  }

  /** A part's title, passage / task / questions text, Listening recording or picture (drafts only). */
  async updatePart(tenant: Tenant, userId: string, testId: string, partId: string, dto: UpdateIeltsTestPartDto): Promise<IeltsTestView> {
    const test = await this.editable(tenant, userId, testId, { draftOnly: true });
    const part = await this.parts.findOne({ where: { id: partId, test_id: test.id } });
    if (!part) this.notFound();
    if (dto.audio_file_id && part.module !== IeltsModuleEnum.LISTENING) this.invalid('Only Listening parts have a recording');
    if (dto.image_file_id && ![IeltsModuleEnum.READING, IeltsModuleEnum.WRITING].includes(part.module)) this.invalid('Only Reading passages and Writing tasks have a picture');
    if (dto.audio_file_id) await this.assertFile(tenant, dto.audio_file_id, 'audio');
    if (dto.image_file_id) await this.assertFile(tenant, dto.image_file_id, 'image');
    await this.parts.update(
      { id: part.id },
      {
        ...(dto.title !== undefined ? { title: dto.title?.trim() || null } : {}),
        ...(dto.content !== undefined ? { content: dto.content || null } : {}),
        ...(dto.audio_file_id !== undefined ? { audio_file_id: dto.audio_file_id } : {}),
        ...(dto.image_file_id !== undefined ? { image_file_id: dto.image_file_id } : {}),
      },
    );
    await this.tests.update({ id: test.id }, { updated_at: new Date() });
    return this.get(tenant, userId, test.id);
  }

  /**
   * The maker, owners and admins publish a draft when it is complete: Listening parts have their
   * recording and questions, Reading passages their text and questions, Writing tasks their text
   * (Academic Task 1 its picture), Speaking parts their questions; a mock's Listening and Reading
   * use all 40 numbers. Otherwise 422 IELTS_TEST_INCOMPLETE with `details.problems`.
   */
  async publish(tenant: Tenant, userId: string, testId: string): Promise<IeltsTestView> {
    const test = await this.editable(tenant, userId, testId, { draftOnly: true });
    const view = await this.get(tenant, userId, test.id);
    const problems = this.problems(view);
    if (problems.length) {
      throw new UnprocessableEntityException({ message: 'The test is not ready to publish', code: IELTS_ERRORS.TEST_INCOMPLETE, details: { problems } });
    }
    return this.setStatus(tenant, userId, test, IeltsTestStatusEnum.PUBLISHED);
  }

  /** Back to a draft (to change it), from published or archived. */
  async unpublish(tenant: Tenant, userId: string, testId: string): Promise<IeltsTestView> {
    const test = await this.editable(tenant, userId, testId, { draftOnly: false });
    if (test.status === IeltsTestStatusEnum.DRAFT) return this.get(tenant, userId, test.id);
    return this.setStatus(tenant, userId, test, IeltsTestStatusEnum.DRAFT);
  }

  /** Put away: no longer offered, kept with its results. */
  async archive(tenant: Tenant, userId: string, testId: string): Promise<IeltsTestView> {
    const test = await this.editable(tenant, userId, testId, { draftOnly: false });
    if (test.status === IeltsTestStatusEnum.ARCHIVED) return this.get(tenant, userId, test.id);
    return this.setStatus(tenant, userId, test, IeltsTestStatusEnum.ARCHIVED);
  }

  /** Any staff member: a draft copy (parts, recordings, pictures, groups, questions) that is theirs. */
  async duplicate(tenant: Tenant, userId: string, testId: string): Promise<IeltsTestView> {
    await this.assertStaff(tenant);
    const source = await this.find(tenant, testId);
    const id = await this.dataSource.transaction(async (manager) => {
      const copy = await manager.getRepository(IeltsTestEntity).save(
        manager.getRepository(IeltsTestEntity).create({
          organization_id: tenant.organizationId,
          title: `${source.title} (copy)`.slice(0, 200),
          test_type: source.test_type,
          purpose: source.purpose,
          modules: source.modules,
          durations: source.durations,
          status: IeltsTestStatusEnum.DRAFT,
          created_by: userId,
        }),
      );
      const parts = await manager.getRepository(IeltsTestPartEntity).find({ where: { test_id: source.id } });
      for (const part of parts) {
        const { id: partId, ...partFields } = part;
        const newPart = await manager.getRepository(IeltsTestPartEntity).save(manager.getRepository(IeltsTestPartEntity).create({ ...partFields, test_id: copy.id }));
        const groups = await manager.getRepository(IeltsQuestionGroupEntity).find({ where: { part_id: partId, deleted_at: IsNull() } });
        for (const group of groups) {
          const { id: groupId, ...groupFields } = group;
          const newGroup = await manager.getRepository(IeltsQuestionGroupEntity).save(manager.getRepository(IeltsQuestionGroupEntity).create({ ...groupFields, part_id: newPart.id }));
          const questions = await manager.getRepository(IeltsQuestionEntity).find({ where: { group_id: groupId, deleted_at: IsNull() } });
          await manager.getRepository(IeltsQuestionEntity).save(questions.map(({ id: _id, ...q }) => manager.getRepository(IeltsQuestionEntity).create({ ...q, group_id: newGroup.id })));
        }
      }
      return copy.id;
    });
    return this.get(tenant, userId, id);
  }

  // ------------------------------------------------------------------ shared with the groups service

  /** A test of the centre the person may change (the maker, an owner or an admin); drafts only when asked. */
  async editable(tenant: Tenant, userId: string, testId: string, { draftOnly }: { draftOnly: boolean }): Promise<IeltsTestEntity> {
    await this.assertStaff(tenant);
    const test = await this.find(tenant, testId);
    if (!this.canEdit(tenant, userId, test)) {
      throw new ForbiddenException({ message: 'Only the teacher who made this test, an owner or an admin can change it', code: IELTS_ERRORS.TEST_NOT_YOURS });
    }
    if (draftOnly && test.status !== IeltsTestStatusEnum.DRAFT) {
      throw new ConflictException({ message: 'Only drafts can be changed; unpublish the test first', code: IELTS_ERRORS.TEST_LOCKED });
    }
    return test;
  }

  /** The file is the centre's IELTS upload of the right kind, not failed or deleted. */
  async assertFile(tenant: Tenant, fileId: string, kind: 'audio' | 'image'): Promise<void> {
    const file = await this.dataSource.getRepository(FileObjectEntity).findOne({
      where: { id: fileId, organization_id: tenant.organizationId, purpose: FilePurposeEnum.IELTS, status: Not(FileStatusEnum.FAILED), deleted_at: IsNull() },
    });
    if (!file || !(kind === 'audio' ? isAudioMime(file.mime) : isImageMime(file.mime))) {
      throw new BadRequestException({ message: `Upload an ${kind === 'audio' ? 'audio file' : 'image'} for IELTS first`, code: IELTS_ERRORS.FILE_INVALID });
    }
  }

  // ------------------------------------------------------------------ helpers

  private problems(view: IeltsTestView): IeltsTestProblem[] {
    const problems: IeltsTestProblem[] = [];
    const used: Partial<Record<IeltsModuleEnum, number>> = {};
    for (const part of view.parts) {
      const at = { module: part.module, part_no: part.part_no };
      const hasText = !!part.content?.replace(/<[^>]*>/g, '').trim();
      const numbers = part.groups.reduce((sum, g) => sum + (g.number_from === null || g.number_to === null ? 0 : g.number_to - g.number_from + 1), 0);
      used[part.module] = (used[part.module] ?? 0) + numbers;
      if (part.module === IeltsModuleEnum.LISTENING && !part.audio_file_id) problems.push({ ...at, problem: 'NO_RECORDING' });
      if (part.module !== IeltsModuleEnum.LISTENING && !hasText) problems.push({ ...at, problem: 'NO_TEXT' });
      if ((part.module === IeltsModuleEnum.LISTENING || part.module === IeltsModuleEnum.READING) && numbers === 0) problems.push({ ...at, problem: 'NO_QUESTIONS' });
      if (part.module === IeltsModuleEnum.WRITING && part.part_no === 1 && view.test_type === IeltsTestTypeEnum.ACADEMIC && !part.image_file_id) {
        problems.push({ ...at, problem: 'NO_PICTURE' });
      }
    }
    if (view.purpose === IeltsTestPurposeEnum.MOCK) {
      for (const module of [IeltsModuleEnum.LISTENING, IeltsModuleEnum.READING]) {
        if (view.modules.includes(module) && used[module] !== MODULE_NUMBERS) problems.push({ module, part_no: null, problem: 'NOT_40', count: used[module] ?? 0 });
      }
    }
    return problems;
  }

  private async setStatus(tenant: Tenant, userId: string, test: IeltsTestEntity, status: IeltsTestStatusEnum): Promise<IeltsTestView> {
    await this.tests.update({ id: test.id }, { status, updated_at: new Date() });
    this.audit.record({
      action: AUDIT_ACTIONS.IELTS_TEST_STATUS,
      organizationId: tenant.organizationId,
      actorId: userId,
      entityType: 'ielts_test',
      entityId: test.id,
      before: { status: test.status },
      after: { status },
    });
    return this.get(tenant, userId, test.id);
  }

  private async assertStaff(tenant: Tenant): Promise<void> {
    if (tenant.memberRole === OrganizationMemberRoleEnum.STUDENT || tenant.viaEnrolment) {
      throw new ForbiddenException({ message: 'Only staff can do this', code: IELTS_ERRORS.STAFF_ONLY });
    }
    await this.profiles.assertIeltsCentre(tenant);
  }

  private canEdit(tenant: Tenant, userId: string, test: IeltsTestEntity): boolean {
    return test.created_by === userId || MANAGERS.includes(tenant.memberRole);
  }

  private async find(tenant: Tenant, testId: string): Promise<IeltsTestEntity> {
    const test = await this.tests.findOne({ where: { id: testId, organization_id: tenant.organizationId, deleted_at: IsNull() } });
    if (!test) this.notFound();
    return test;
  }

  /** Modules, times and parts for a new test from its template. */
  private layout(dto: CreateIeltsTestDto): { modules: IeltsModuleEnum[]; durations: Partial<Record<IeltsModuleEnum, number>>; parts: { module: IeltsModuleEnum; part_no: number }[] } {
    if (dto.purpose === IeltsTestPurposeEnum.MOCK) {
      if (dto.module !== undefined || dto.part_nos !== undefined) this.invalid('A mock has every part; choose its modules only');
      const modules = sortModules(dto.modules ?? MODULE_ORDER);
      return {
        modules,
        durations: Object.fromEntries(modules.map((m) => [m, MOCK_DURATIONS[m]])),
        parts: modules.flatMap((module) => Array.from({ length: PART_COUNT[module] }, (_, i) => ({ module, part_no: i + 1 }))),
      };
    }
    if (!dto.module || !dto.part_nos?.length || dto.modules !== undefined) this.invalid('A practice set has one module and the parts it includes');
    const module = dto.module;
    const partNos = [...dto.part_nos].sort((a, b) => a - b);
    if (partNos.some((n) => n < 1 || n > PART_COUNT[module])) this.invalid(`${module} has parts 1 to ${PART_COUNT[module]}`);
    return {
      modules: [module],
      durations: { [module]: practiceDuration(module, partNos) },
      parts: partNos.map((part_no) => ({ module, part_no })),
    };
  }

  private summary(test: IeltsTestEntity, names: Map<string, string>): Omit<IeltsTestSummary, 'question_counts'> {
    return {
      id: test.id,
      title: test.title,
      test_type: test.test_type,
      purpose: test.purpose,
      modules: test.modules,
      durations: test.durations,
      status: test.status,
      needs_review: test.needs_review,
      created_by: { id: test.created_by, full_name: names.get(test.created_by) ?? '' },
      updated_at: test.updated_at,
    };
  }

  private async names(ids: string[]): Promise<Map<string, string>> {
    const rows: { id: string; full_name: string }[] = await this.dataSource.query(`SELECT id, full_name FROM users WHERE id = ANY($1::uuid[])`, [[...new Set(ids)]]);
    return new Map(rows.map((r) => [r.id, r.full_name]));
  }

  private invalid(message: string): never {
    throw new BadRequestException({ message, code: IELTS_ERRORS.TEST_INVALID });
  }

  private notFound(): never {
    throw new NotFoundException({ message: 'Test not found', code: IELTS_ERRORS.TEST_NOT_FOUND });
  }
}
