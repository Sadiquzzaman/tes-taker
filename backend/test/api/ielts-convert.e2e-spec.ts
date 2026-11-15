import { randomUUID } from 'crypto';
import { DeepPartial } from 'typeorm';
import { RolesEnum } from '../../src/common/enums/roles.enum';
import { OrganizationEntity } from '../../src/organizations/entities/organization.entity';
import { OrganizationKindEnum } from '../../src/organizations/enums/organization-kind.enum';
import { OrganizationMemberRoleEnum } from '../../src/organizations/enums/organization-member-role.enum';
import { WorkspaceTypeEnum } from '../../src/organizations/enums/workspace-type.enum';
import { UserEntity } from '../../src/user/entities/user.entity';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

type Body<T> = { payload: T; code?: string; details?: { test_id: string } };
type Test = { id: string; title: string; status: string; purpose: string; needs_review: boolean; modules: string[]; parts: { module: string; part_no: number; content: string | null; groups: { type: string; questions: { answer: unknown }[] }[] }[] };

/**
 * Copying academic-builder IELTS exams into the new format (P10-08): a draft marked "check before
 * use", the old exam untouched, questions that do not fit listed, and only once per exam.
 */
describe('IELTS conversion of old exams', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;
  let admin: UserEntity;

  const call = <T>(method: string, path: string, token: string, body?: unknown) => t.api.request<Body<T>>(method, path, { token, body });

  beforeAll(async () => {
    t = await createTestApp();
    make = factories(t.dataSource);
    admin = await make.user(RolesEnum.SUPER_ADMIN);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterAll(async () => {
    await t.close();
  });

  it('copies an old IELTS exam into a draft to check, once', async () => {
    const owner = await make.teacher({ personal_teacher_enabled: false });
    const organization = await make.organization(owner);
    await t.dataSource.getRepository(OrganizationEntity).update({ id: organization.id }, { kind: OrganizationKindEnum.IELTS_CENTRE, workspace_type: WorkspaceTypeEnum.IELTS } as DeepPartial<OrganizationEntity>);
    await t.api.request('PUT', `/subscriptions/admin/organizations/${organization.id}/overrides/ielts`, { body: { value: true, reason: 'P10-08 test' }, token: t.tokenFor(admin) });
    const ownerToken = t.tokenFor(owner, { session_mode: 'organization', context_type: 'organization', organization_id: organization.id, member_role: OrganizationMemberRoleEnum.OWNER });

    const examId = randomUUID();
    await t.dataSource.query(`INSERT INTO exams (id, exam_category, test_name, organization_id) VALUES ($1, 'ielts', 'Cambridge-style mock', $2)`, [examId, organization.id]);
    const insert = (row: Record<string, unknown>) =>
      t.dataSource.query(
        `INSERT INTO exam_questions (id, exam_id, module_key, parent_id, category, sub_type, sort_order, question, passage_text, options_json, answer_json)
         VALUES ($1, $2, $3, $4, 'ielts', $5, $6, $7, $8, $9, $10)`,
        [row.id ?? randomUUID(), examId, row.module_key, row.parent_id ?? null, row.sub_type ?? null, row.sort_order, row.question, row.passage_text ?? null, row.options ? JSON.stringify(row.options) : null, row.answer ? JSON.stringify(row.answer) : null],
      );
    const passageId = randomUUID();
    await insert({ id: passageId, module_key: 'ielts.reading', sort_order: 1, question: 'Passage', passage_text: 'Glass was first made in Egypt.' });
    await insert({ module_key: 'ielts.reading', parent_id: passageId, sub_type: 'short-answer', sort_order: 2, question: 'Where?', answer: { type: 'text', value: ['Egypt'] } });
    await insert({ module_key: 'ielts.reading', parent_id: passageId, sub_type: 'multiple-choice', sort_order: 3, question: 'Which?', options: [{ id: 'a', text: 'Sand' }, { id: 'b', text: 'Salt' }], answer: { type: 'optionId', value: ['a'] } });
    await insert({ module_key: 'ielts.reading', parent_id: passageId, sub_type: 'essay', sort_order: 4, question: 'Discuss.' });
    await insert({ module_key: 'ielts.writing', sub_type: 'writing-task-2', sort_order: 5, question: 'Some people think…' });

    const before = (await call<{ id: string; title: string; converted_test_id: string | null }[]>('GET', '/ielts/old-exams', ownerToken)).body.payload;
    expect(before).toEqual([expect.objectContaining({ id: examId, title: 'Cambridge-style mock', converted_test_id: null })]);

    const converted = await call<{ test_id: string; converted: number; skipped: { reason: string }[] }>('POST', `/ielts/old-exams/${examId}/convert`, ownerToken);
    expect(converted.status).toBe(201);
    expect(converted.body.payload).toMatchObject({ converted: 2, skipped: [{ reason: '"essay" questions have no IELTS type' }] });

    const test = (await call<Test>('GET', `/ielts/tests/${converted.body.payload.test_id}`, ownerToken)).body.payload;
    expect(test).toMatchObject({ title: 'Cambridge-style mock (converted)', status: 'DRAFT', purpose: 'MOCK', needs_review: true, modules: ['READING', 'WRITING'] });
    expect(test.parts.map((p) => `${p.module[0]}${p.part_no}`)).toEqual(['R1', 'R2', 'R3', 'W1', 'W2']);
    const reading = test.parts[0];
    expect(reading.content).toBe('<p>Glass was first made in Egypt.</p>');
    expect(reading.groups.map((g) => g.type)).toEqual(['SHORT_ANSWER', 'MCQ_SINGLE']);
    expect(test.parts.find((p) => p.module === 'WRITING' && p.part_no === 2)?.content).toBe('<p>Some people think…</p>');

    // Once only; the old exam is untouched.
    const again = await call('POST', `/ielts/old-exams/${examId}/convert`, ownerToken);
    expect([again.status, again.body.code, again.body.details?.test_id]).toEqual([409, 'IELTS_ALREADY_CONVERTED', test.id]);
    expect((await t.dataSource.query(`SELECT count(*)::int AS n FROM exam_questions WHERE exam_id = $1`, [examId]))[0].n).toBe(5);
    expect((await call('POST', `/ielts/old-exams/${randomUUID()}/convert`, ownerToken)).body.code).toBe('IELTS_OLD_EXAM_NOT_FOUND');
  });
});
