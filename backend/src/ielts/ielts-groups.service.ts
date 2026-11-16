import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, In, IsNull } from 'typeorm';
import { Tenant } from 'src/common/tenancy/tenant-context';
import { OrderIeltsGroupsDto, SaveIeltsGroupDto } from './dto/ielts-group.dto';
import { IeltsModuleEnum } from './entities/ielts-profile.entity';
import { IeltsQuestionGroupEntity } from './entities/ielts-question-group.entity';
import { IeltsQuestionEntity } from './entities/ielts-question.entity';
import { IeltsTestEntity } from './entities/ielts-test.entity';
import { IeltsTestPartEntity } from './entities/ielts-test-part.entity';
import { IELTS_ERRORS } from './ielts-errors';
import { IeltsTestsService, IeltsTestView } from './ielts-tests.service';
import { cleanAnswer, groupProblem, MODULE_NUMBERS, MODULE_NUMBERS_SQL } from './question-groups';

/**
 * Question groups and their questions (IEL-03), on Listening parts and Reading passages of a
 * draft. Saving a group replaces its questions: ones sent with their id are kept, new ones added,
 * the rest hidden (soft-deleted), so answers given to them stay readable. A module has at most
 * 40 numbers. Removing a group hides it with its questions.
 */
@Injectable()
export class IeltsGroupsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tests: IeltsTestsService,
  ) {}

  async create(tenant: Tenant, userId: string, testId: string, partId: string, dto: SaveIeltsGroupDto): Promise<IeltsTestView> {
    const test = await this.tests.editable(tenant, userId, testId, { draftOnly: true });
    const part = await this.part(test.id, partId);
    await this.check(tenant, part.module, dto);
    await this.dataSource.transaction(async (manager) => {
      await this.lock(manager, test.id);
      const groups = manager.getRepository(IeltsQuestionGroupEntity);
      const [last] = await groups.find({ where: { part_id: part.id, deleted_at: IsNull() }, order: { sort_order: 'DESC' }, take: 1 });
      const group = await groups.save(groups.create({ part_id: part.id, ...this.groupFields(dto), sort_order: (last?.sort_order ?? 0) + 1 }));
      await this.saveQuestions(manager, group.id, dto, []);
      await this.assertNumbers(manager, test, part.module);
    });
    return this.tests.get(tenant, userId, test.id);
  }

  async update(tenant: Tenant, userId: string, testId: string, groupId: string, dto: SaveIeltsGroupDto): Promise<IeltsTestView> {
    const test = await this.tests.editable(tenant, userId, testId, { draftOnly: true });
    const group = await this.group(test.id, groupId);
    const part = await this.part(test.id, group.part_id);
    await this.check(tenant, part.module, dto);
    await this.dataSource.transaction(async (manager) => {
      await this.lock(manager, test.id);
      await manager.getRepository(IeltsQuestionGroupEntity).update({ id: group.id }, this.groupFields(dto));
      const existing = await manager.getRepository(IeltsQuestionEntity).find({ where: { group_id: group.id, deleted_at: IsNull() } });
      await this.saveQuestions(manager, group.id, dto, existing);
      await this.assertNumbers(manager, test, part.module);
    });
    return this.tests.get(tenant, userId, test.id);
  }

  /** Hides a group and its questions. */
  async remove(tenant: Tenant, userId: string, testId: string, groupId: string): Promise<IeltsTestView> {
    const test = await this.tests.editable(tenant, userId, testId, { draftOnly: true });
    const group = await this.group(test.id, groupId);
    const now = new Date();
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(IeltsQuestionGroupEntity).update({ id: group.id }, { deleted_at: now, deleted_by: userId });
      await manager.getRepository(IeltsQuestionEntity).update({ group_id: group.id, deleted_at: IsNull() }, { deleted_at: now });
      await manager.getRepository(IeltsTestEntity).update({ id: test.id }, { updated_at: now });
    });
    return this.tests.get(tenant, userId, test.id);
  }

  /** Puts a part's groups in a new order (every live group, once). */
  async reorder(tenant: Tenant, userId: string, testId: string, partId: string, dto: OrderIeltsGroupsDto): Promise<IeltsTestView> {
    const test = await this.tests.editable(tenant, userId, testId, { draftOnly: true });
    const part = await this.part(test.id, partId);
    const live = await this.dataSource.getRepository(IeltsQuestionGroupEntity).find({ where: { part_id: part.id, deleted_at: IsNull() } });
    if (live.length !== dto.group_ids.length || !live.every((g) => dto.group_ids.includes(g.id))) {
      this.invalid('Send every group of the part once, in the new order');
    }
    await this.dataSource.transaction(async (manager) => {
      for (const [i, id] of dto.group_ids.entries()) {
        await manager.getRepository(IeltsQuestionGroupEntity).update({ id }, { sort_order: i + 1 });
      }
      await manager.getRepository(IeltsTestEntity).update({ id: test.id }, { updated_at: new Date() });
    });
    return this.tests.get(tenant, userId, test.id);
  }

  // ------------------------------------------------------------------ helpers

  private async check(tenant: Tenant, module: IeltsModuleEnum, dto: SaveIeltsGroupDto): Promise<void> {
    if (module !== IeltsModuleEnum.LISTENING && module !== IeltsModuleEnum.READING) this.invalid('Only Listening parts and Reading passages have question groups');
    const problem = groupProblem(module, dto);
    if (problem) this.invalid(problem);
    if (dto.image_file_id) await this.tests.assertFile(tenant, dto.image_file_id, 'image');
  }

  private groupFields(dto: SaveIeltsGroupDto): Pick<IeltsQuestionGroupEntity, 'type' | 'instruction' | 'word_limit' | 'shared' | 'image_file_id'> {
    return {
      type: dto.type,
      instruction: dto.instruction.trim(),
      word_limit: dto.word_limit ?? null,
      shared: dto.shared
        ? {
            ...(dto.shared.options ? { options: dto.shared.options.map((o) => ({ key: o.key.trim(), text: o.text.trim() })) } : {}),
            ...(dto.shared.text !== undefined ? { text: dto.shared.text } : {}),
          }
        : null,
      image_file_id: dto.image_file_id ?? null,
    };
  }

  /** Keeps questions sent with their id, adds new ones, hides the rest; order follows the list. */
  private async saveQuestions(manager: EntityManager, groupId: string, dto: SaveIeltsGroupDto, existing: IeltsQuestionEntity[]): Promise<void> {
    const repo = manager.getRepository(IeltsQuestionEntity);
    const known = new Set(existing.map((q) => q.id));
    if (dto.questions.some((q) => q.id && !known.has(q.id))) this.invalid('A question does not belong to this group');
    const kept = new Set(dto.questions.map((q) => q.id).filter(Boolean));
    const gone = existing.filter((q) => !kept.has(q.id)).map((q) => q.id);
    if (gone.length) await repo.update({ id: In(gone) }, { deleted_at: new Date() });
    for (const [i, q] of dto.questions.entries()) {
      const fields = {
        sort_order: i + 1,
        prompt: q.prompt?.trim() || null,
        options: q.options ? q.options.map((o) => ({ key: o.key.trim(), text: o.text.trim() })) : null,
        answer: cleanAnswer(q.answer),
      };
      if (q.id) await repo.update({ id: q.id }, fields);
      else await repo.save(repo.create({ group_id: groupId, ...fields }));
    }
  }

  /** One builder at a time per test, so two saves cannot pass 40 numbers together. */
  private async lock(manager: EntityManager, testId: string): Promise<void> {
    await manager.query(`SELECT id FROM ielts_tests WHERE id = $1 FOR UPDATE`, [testId]);
    await manager.getRepository(IeltsTestEntity).update({ id: testId }, { updated_at: new Date() });
  }

  private async assertNumbers(manager: EntityManager, test: IeltsTestEntity, module: IeltsModuleEnum): Promise<void> {
    const [{ n }] = await manager.query(MODULE_NUMBERS_SQL, [test.id, module]);
    if (n > MODULE_NUMBERS) this.invalid(`${module} would have ${n} questions; a module has at most ${MODULE_NUMBERS}`);
  }

  private async part(testId: string, partId: string): Promise<IeltsTestPartEntity> {
    const part = await this.dataSource.getRepository(IeltsTestPartEntity).findOne({ where: { id: partId, test_id: testId } });
    if (!part) throw new NotFoundException({ message: 'Part not found', code: IELTS_ERRORS.TEST_NOT_FOUND });
    return part;
  }

  private async group(testId: string, groupId: string): Promise<IeltsQuestionGroupEntity> {
    const group = await this.dataSource
      .getRepository(IeltsQuestionGroupEntity)
      .createQueryBuilder('g')
      .innerJoin(IeltsTestPartEntity, 'p', 'p.id = g.part_id')
      .where('g.id = :groupId AND p.test_id = :testId AND g.deleted_at IS NULL', { groupId, testId })
      .getOne();
    if (!group) throw new NotFoundException({ message: 'Question group not found', code: IELTS_ERRORS.GROUP_NOT_FOUND });
    return group;
  }

  private invalid(message: string): never {
    throw new BadRequestException({ message, code: IELTS_ERRORS.GROUP_INVALID });
  }
}
