import { DeepPartial } from 'typeorm';
import { AuditService } from '../../src/audit/audit.service';
import { AuditLogEntity } from '../../src/audit/entities/audit-log.entity';
import { RolesEnum } from '../../src/common/enums/roles.enum';
import { FileObjectEntity } from '../../src/files/entities/file-object.entity';
import { FilePurposeEnum, FileStatusEnum } from '../../src/files/file-rules';
import { IeltsQuestionEntity } from '../../src/ielts/entities/ielts-question.entity';
import { OrganizationEntity } from '../../src/organizations/entities/organization.entity';
import { OrganizationKindEnum } from '../../src/organizations/enums/organization-kind.enum';
import { OrganizationMemberRoleEnum } from '../../src/organizations/enums/organization-member-role.enum';
import { WorkspaceTypeEnum } from '../../src/organizations/enums/workspace-type.enum';
import { UserEntity } from '../../src/user/entities/user.entity';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

type Body<T> = { payload: T; code?: string; message?: string; details?: { problems: Problem[] } };
type Problem = { module: string; part_no: number | null; problem: string; count?: number };
type Question = { id: string; number_from: number; number_to: number; prompt: string | null; answer: Record<string, string[]> };
type Group = { id: string; type: string; number_from: number | null; number_to: number | null; questions: Question[] };
type Part = { id: string; module: string; part_no: number; groups: Group[] };
type Test = { id: string; title: string; status: string; can_edit: boolean; parts: Part[]; question_counts?: Record<string, number> };

/**
 * Question groups (P10-02, IEL-03): groups on Listening parts and Reading passages with the paper's
 * rules, numbers 1–40 through each module, questions kept by id and hidden when dropped, and
 * publishing only a complete test (a mock's Listening and Reading use all 40 numbers).
 */
describe('IELTS question groups and publishing', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;
  let admin: UserEntity;

  const call = <T>(method: string, path: string, token: string, body?: unknown) => t.api.request<Body<T>>(method, path, { token, body });

  const centre = async () => {
    const owner = await make.teacher({ personal_teacher_enabled: false });
    const organization = await make.organization(owner);
    await t.dataSource.getRepository(OrganizationEntity).update({ id: organization.id }, { kind: OrganizationKindEnum.IELTS_CENTRE, workspace_type: WorkspaceTypeEnum.IELTS } as DeepPartial<OrganizationEntity>);
    expect((await t.api.request('PUT', `/subscriptions/admin/organizations/${organization.id}/overrides/ielts`, { body: { value: true, reason: 'P10-02 test' }, token: t.tokenFor(admin) })).status).toBe(200);
    const token = (user: UserEntity, role: OrganizationMemberRoleEnum) =>
      t.tokenFor(user, { session_mode: 'organization', context_type: 'organization', organization_id: organization.id, member_role: role });
    const [tania, rafiq] = [await make.teacher(), await make.teacher()];
    await make.member(organization, tania, OrganizationMemberRoleEnum.TEACHER);
    await make.member(organization, rafiq, OrganizationMemberRoleEnum.TEACHER);
    return { organization, tania, rafiq, taniaToken: token(tania, OrganizationMemberRoleEnum.TEACHER), rafiqToken: token(rafiq, OrganizationMemberRoleEnum.TEACHER) };
  };

  const file = (organizationId: string, ownerId: string, mime: string) =>
    t.dataSource.getRepository(FileObjectEntity).save({
      organization_id: organizationId,
      owner_id: ownerId,
      purpose: FilePurposeEnum.IELTS,
      s3_key: `org/${organizationId}/ielts/${Math.random()}`,
      mime,
      original_name: 'file',
      size_bytes: 3000,
      original_size_bytes: 3000,
      status: FileStatusEnum.READY,
    } as DeepPartial<FileObjectEntity>);

  /** A short-answer group of `n` questions. */
  const shortAnswers = (n: number, extra: Record<string, unknown> = {}) => ({
    type: 'SHORT_ANSWER',
    instruction: 'Answer the questions below. Write NO MORE THAN TWO WORDS.',
    word_limit: 2,
    questions: Array.from({ length: n }, (_, i) => ({ prompt: `Question ${i + 1}?`, answer: { accepted: [`answer ${i + 1}`] } })),
    ...extra,
  });

  const abcde = ['A', 'B', 'C', 'D', 'E'].map((key) => ({ key, text: `Option ${key}` }));
  const part = (test: Test, module: string, no: number) => test.parts.find((p) => p.module === module && p.part_no === no) as Part;

  beforeAll(async () => {
    t = await createTestApp();
    make = factories(t.dataSource);
    admin = await make.user(RolesEnum.SUPER_ADMIN);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterAll(async () => {
    await t.close();
  });

  it('numbers questions 1–40 through each module; "Choose TWO" takes two numbers', async () => {
    const s = await centre();
    const test = (await call<Test>('POST', '/ielts/tests', s.taniaToken, { title: 'Mock', test_type: 'ACADEMIC', purpose: 'MOCK', modules: ['LISTENING', 'READING'] })).body.payload;
    const add = (partId: string, body: unknown) => call<Test>('POST', `/ielts/tests/${test.id}/parts/${partId}/groups`, s.taniaToken, body);

    expect((await add(part(test, 'LISTENING', 2).id, shortAnswers(3))).status).toBe(201);
    await add(part(test, 'LISTENING', 1).id, {
      type: 'NOTE_COMPLETION',
      instruction: 'Complete the notes. Write ONE WORD AND/OR A NUMBER.',
      word_limit: 1,
      shared: { text: 'Hotel on [[1]] Road, room [[2]]' },
      questions: [{ answer: { accepted: ['Sea'] } }, { answer: { accepted: ['21'] } }],
    });
    await add(part(test, 'LISTENING', 1).id, { type: 'MCQ_MULTI', instruction: 'Choose TWO letters, A–E.', questions: [{ prompt: 'Which TWO facilities?', options: abcde, answer: { keys: ['B', 'E'] } }] });
    const last = await add(part(test, 'READING', 1).id, {
      type: 'TFNG',
      instruction: 'Do the statements agree with the passage?',
      questions: [{ prompt: 'The museum opened in 1900.', answer: { keys: ['TRUE'] } }, { prompt: 'It is free.', answer: { keys: ['NOT GIVEN'] } }],
    });
    const view = last.body.payload;
    const ranges = (p: Part) => p.groups.map((g) => [g.type, g.number_from, g.number_to]);
    expect(ranges(part(view, 'LISTENING', 1))).toEqual([['NOTE_COMPLETION', 1, 2], ['MCQ_MULTI', 3, 4]]);
    expect(ranges(part(view, 'LISTENING', 2))).toEqual([['SHORT_ANSWER', 5, 7]]);
    // Reading starts again at 1.
    expect(ranges(part(view, 'READING', 1))).toEqual([['TFNG', 1, 2]]);
    expect(part(view, 'LISTENING', 1).groups[1].questions[0]).toMatchObject({ number_from: 3, number_to: 4 });

    const [listed] = (await call<Test[]>('GET', '/ielts/tests', s.rafiqToken)).body.payload;
    expect(listed.question_counts).toEqual({ LISTENING: 7, READING: 2 });

    // Reordering renumbers.
    const listening1 = part(view, 'LISTENING', 1);
    const reordered = await call<Test>('PUT', `/ielts/tests/${test.id}/parts/${listening1.id}/groups/order`, s.taniaToken, { group_ids: [listening1.groups[1].id, listening1.groups[0].id] });
    expect(ranges(part(reordered.body.payload, 'LISTENING', 1))).toEqual([['MCQ_MULTI', 1, 2], ['NOTE_COMPLETION', 3, 4]]);
    expect((await call('PUT', `/ielts/tests/${test.id}/parts/${listening1.id}/groups/order`, s.taniaToken, { group_ids: [listening1.groups[0].id] })).body.code).toBe('IELTS_GROUP_INVALID');
  });

  it('keeps questions sent with their id, hides the rest, and follows the paper’s rules', async () => {
    const s = await centre();
    const test = (await call<Test>('POST', '/ielts/tests', s.taniaToken, { title: 'Practice', test_type: 'ACADEMIC', purpose: 'PRACTICE', module: 'READING', part_nos: [1] })).body.payload;
    const passage = part(test, 'READING', 1);
    const created = (await call<Test>('POST', `/ielts/tests/${test.id}/parts/${passage.id}/groups`, s.taniaToken, shortAnswers(3))).body.payload;
    const group = part(created, 'READING', 1).groups[0];
    const [q1, q2, q3] = group.questions;

    const saved = await call<Test>('PUT', `/ielts/tests/${test.id}/groups/${group.id}`, s.taniaToken, {
      ...shortAnswers(0),
      questions: [
        { id: q3.id, prompt: 'Now first?', answer: { accepted: ['  colour ', 'color'] } },
        { id: q1.id, prompt: q1.prompt, answer: q1.answer },
        { prompt: 'Brand new?', answer: { accepted: ['new'] } },
      ],
    });
    expect(saved.status).toBe(200);
    const questions = part(saved.body.payload, 'READING', 1).groups[0].questions;
    expect(questions.map((q) => [q.number_from, q.prompt])).toEqual([[1, 'Now first?'], [2, 'Question 1?'], [3, 'Brand new?']]);
    expect(questions[0]).toMatchObject({ id: q3.id, answer: { accepted: ['colour', 'color'] } });
    // The dropped question is hidden, not deleted.
    expect((await t.dataSource.getRepository(IeltsQuestionEntity).findOneByOrFail({ id: q2.id })).deleted_at).not.toBeNull();

    const bad = async (body: unknown, path = `/ielts/tests/${test.id}/groups/${group.id}`, method = 'PUT') => (await call(method, path, s.taniaToken, body)).body;
    expect((await bad({ ...shortAnswers(1), word_limit: 1, questions: [{ prompt: 'x', answer: { accepted: ['two words'] } }] })).code).toBe('IELTS_GROUP_INVALID');
    expect((await bad({ ...shortAnswers(1), questions: [{ id: test.id, prompt: 'x', answer: { accepted: ['a'] } }] })).message).toMatch(/does not belong/);
    expect((await bad({ type: 'FORM_COMPLETION', instruction: 'Complete the form.', questions: [{ answer: { accepted: ['a'] } }] })).message).toMatch(/not used in READING/);
    expect((await call('PUT', `/ielts/tests/${test.id}/groups/${group.id}`, s.taniaToken, shortAnswers(41))).status).toBe(400);
    // At most 40 numbers in a module.
    expect((await bad(shortAnswers(38), `/ielts/tests/${test.id}/parts/${passage.id}/groups`, 'POST')).message).toMatch(/at most 40/);
    expect(part((await call<Test>('GET', `/ielts/tests/${test.id}`, s.taniaToken)).body.payload, 'READING', 1).groups).toHaveLength(1);

    // Writing and Speaking parts have no groups; another teacher cannot change it.
    const writing = (await call<Test>('POST', '/ielts/tests', s.taniaToken, { title: 'W', test_type: 'ACADEMIC', purpose: 'PRACTICE', module: 'WRITING', part_nos: [1] })).body.payload;
    expect((await bad(shortAnswers(1), `/ielts/tests/${writing.id}/parts/${writing.parts[0].id}/groups`, 'POST')).message).toMatch(/Only Listening parts and Reading passages/);
    expect((await call('PUT', `/ielts/tests/${test.id}/groups/${group.id}`, s.rafiqToken, shortAnswers(1))).body.code).toBe('IELTS_TEST_NOT_YOURS');

    // Removing a group hides it with its questions.
    const removed = await call<Test>('DELETE', `/ielts/tests/${test.id}/groups/${group.id}`, s.taniaToken);
    expect(part(removed.body.payload, 'READING', 1).groups).toEqual([]);
    expect(await t.dataSource.getRepository(IeltsQuestionEntity).count({ where: { group_id: group.id } })).toBe(4);
    expect((await call('DELETE', `/ielts/tests/${test.id}/groups/${group.id}`, s.taniaToken)).body.code).toBe('IELTS_GROUP_NOT_FOUND');
  });

  it('publishes only complete tests and says what is missing', async () => {
    const s = await centre();
    const mock = (await call<Test>('POST', '/ielts/tests', s.taniaToken, { title: 'Mock', test_type: 'ACADEMIC', purpose: 'MOCK' })).body.payload;
    const res = await call('POST', `/ielts/tests/${mock.id}/publish`, s.taniaToken);
    expect([res.status, res.body.code]).toEqual([422, 'IELTS_TEST_INCOMPLETE']);
    const problems = res.body.details?.problems ?? [];
    expect(problems).toEqual(
      expect.arrayContaining([
        { module: 'LISTENING', part_no: 1, problem: 'NO_RECORDING' },
        { module: 'LISTENING', part_no: 1, problem: 'NO_QUESTIONS' },
        { module: 'READING', part_no: 3, problem: 'NO_TEXT' },
        { module: 'WRITING', part_no: 1, problem: 'NO_PICTURE' },
        { module: 'SPEAKING', part_no: 2, problem: 'NO_TEXT' },
        { module: 'LISTENING', part_no: null, problem: 'NOT_40', count: 0 },
        { module: 'READING', part_no: null, problem: 'NOT_40', count: 0 },
      ]),
    );

    // A Reading mock with 13 + 13 + 14 questions and its three passages is ready.
    const reading = (await call<Test>('POST', '/ielts/tests', s.taniaToken, { title: 'Reading mock', test_type: 'GENERAL', purpose: 'MOCK', modules: ['READING'] })).body.payload;
    for (const [no, n] of [[1, 13], [2, 13], [3, 13]] as const) {
      const p = part(reading, 'READING', no);
      await call('PUT', `/ielts/tests/${reading.id}/parts/${p.id}`, s.taniaToken, { content: `<p>Passage ${no}</p>` });
      await call('POST', `/ielts/tests/${reading.id}/parts/${p.id}/groups`, s.taniaToken, shortAnswers(n));
    }
    const short = await call('POST', `/ielts/tests/${reading.id}/publish`, s.taniaToken);
    expect(short.body.details?.problems).toEqual([{ module: 'READING', part_no: null, problem: 'NOT_40', count: 39 }]);
    await call('POST', `/ielts/tests/${reading.id}/parts/${part(reading, 'READING', 3).id}/groups`, s.taniaToken, shortAnswers(1));
    const published = await call<Test>('POST', `/ielts/tests/${reading.id}/publish`, s.taniaToken);
    expect([published.status, published.body.payload.status]).toEqual([200, 'PUBLISHED']);
    expect((await call('POST', `/ielts/tests/${reading.id}/parts/${part(reading, 'READING', 1).id}/groups`, s.taniaToken, shortAnswers(1))).body.code).toBe('IELTS_TEST_LOCKED');

    // A Writing practice set needs its task (Academic Task 1 also its picture).
    const writing = (await call<Test>('POST', '/ielts/tests', s.taniaToken, { title: 'Task 1', test_type: 'ACADEMIC', purpose: 'PRACTICE', module: 'WRITING', part_nos: [1] })).body.payload;
    const chart = await file(s.organization.id, s.tania.id, 'image/png');
    await call('PUT', `/ielts/tests/${writing.id}/parts/${writing.parts[0].id}`, s.taniaToken, { content: '<p>The chart shows…</p>', image_file_id: chart.id });
    expect((await call<Test>('POST', `/ielts/tests/${writing.id}/publish`, s.taniaToken)).body.payload.status).toBe('PUBLISHED');

    expect((await call<Test>('POST', `/ielts/tests/${reading.id}/unpublish`, s.taniaToken)).body.payload.status).toBe('DRAFT');
    expect((await call<Test>('POST', `/ielts/tests/${reading.id}/archive`, s.taniaToken)).body.payload.status).toBe('ARCHIVED');
    expect((await call('POST', `/ielts/tests/${writing.id}/archive`, s.rafiqToken)).body.code).toBe('IELTS_TEST_NOT_YOURS');
    await t.app.get(AuditService).flush();
    expect(await t.dataSource.getRepository(AuditLogEntity).count({ where: { organization_id: s.organization.id, action: 'ielts.test_status' } })).toBe(4);
  });

  it('copies a test as a draft for whoever copies it', async () => {
    const s = await centre();
    const test = (await call<Test>('POST', '/ielts/tests', s.taniaToken, { title: 'Listening set', test_type: 'ACADEMIC', purpose: 'PRACTICE', module: 'LISTENING', part_nos: [1, 2] })).body.payload;
    const audio = await file(s.organization.id, s.tania.id, 'audio/mpeg');
    await call('PUT', `/ielts/tests/${test.id}/parts/${part(test, 'LISTENING', 1).id}`, s.taniaToken, { audio_file_id: audio.id });
    const withGroup = (await call<Test>('POST', `/ielts/tests/${test.id}/parts/${part(test, 'LISTENING', 2).id}/groups`, s.taniaToken, shortAnswers(2))).body.payload;
    await call('DELETE', `/ielts/tests/${test.id}/groups/${part(withGroup, 'LISTENING', 2).groups[0].id}`, s.taniaToken);
    await call('POST', `/ielts/tests/${test.id}/parts/${part(test, 'LISTENING', 2).id}/groups`, s.taniaToken, shortAnswers(4));

    const copy = await call<Test & { status: string }>('POST', `/ielts/tests/${test.id}/duplicate`, s.rafiqToken);
    expect(copy.status).toBe(201);
    expect(copy.body.payload).toMatchObject({ title: 'Listening set (copy)', status: 'DRAFT', can_edit: true });
    expect(copy.body.payload.id).not.toBe(test.id);
    expect(copy.body.payload.parts.map((p) => [p.part_no, p.groups.map((g) => g.questions.length)])).toEqual([[1, []], [2, [4]]]);
    expect((copy.body.payload.parts[0] as Part & { audio_file_id: string }).audio_file_id).toBe(audio.id);
    // The original is untouched and still Tania's.
    expect((await call<Test>('GET', `/ielts/tests/${test.id}`, s.rafiqToken)).body.payload.can_edit).toBe(false);
  });
});
