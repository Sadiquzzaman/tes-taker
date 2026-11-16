import { DeepPartial } from 'typeorm';
import { RolesEnum } from '../../src/common/enums/roles.enum';
import { FileObjectEntity } from '../../src/files/entities/file-object.entity';
import { FilePurposeEnum, FileStatusEnum } from '../../src/files/file-rules';
import { IeltsAttemptEntity } from '../../src/ielts/entities/ielts-attempt.entity';
import { IeltsPracticeBands1756500000000 } from '../../src/migrations/1756500000000-IeltsPracticeBands';
import { OrganizationEntity } from '../../src/organizations/entities/organization.entity';
import { OrganizationKindEnum } from '../../src/organizations/enums/organization-kind.enum';
import { OrganizationMemberRoleEnum } from '../../src/organizations/enums/organization-member-role.enum';
import { WorkspaceTypeEnum } from '../../src/organizations/enums/workspace-type.enum';
import { UserEntity } from '../../src/user/entities/user.entity';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

type Body<T> = { payload: T; code?: string; message?: string };
type Question = { id: string; number_from: number; prompt: string | null; answer?: unknown; key?: unknown; marks?: number };
type Part = { id: string; module: string; part_no: number; groups: { type: string; questions: Question[] }[] };
type Test = { id: string; parts: Part[] };
type Attempt = { attempt: { id: string; status: string; raw_score: number | null; raw_total?: number | null; band: number | null; deadline: string; review_seconds: number }; parts: Part[] | null; answers: Record<string, string> };
type Mine = { id: string; is_open: boolean; test: { title: string }; attempts: Record<string, { status: string; band: number | null }> };

/**
 * Taking IELTS tests (P10-04, IEL-04, IEL-05, IEL-08): staff open a published test for a batch in a
 * window; students start a module with its own timer, save answers, hand in, and Listening /
 * Reading are marked out of 40 with a band from the centre's table.
 */
describe('IELTS openings and attempts', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;
  let admin: UserEntity;

  const call = <T>(method: string, path: string, token: string, body?: unknown) => t.api.request<Body<T>>(method, path, { token, body });
  const hour = 3_600_000;
  const iso = (offset: number) => new Date(Date.now() + offset).toISOString();

  const centre = async () => {
    const owner = await make.teacher({ personal_teacher_enabled: false });
    const organization = await make.organization(owner);
    await t.dataSource.getRepository(OrganizationEntity).update({ id: organization.id }, { kind: OrganizationKindEnum.IELTS_CENTRE, workspace_type: WorkspaceTypeEnum.IELTS } as DeepPartial<OrganizationEntity>);
    expect((await t.api.request('PUT', `/subscriptions/admin/organizations/${organization.id}/overrides/ielts`, { body: { value: true, reason: 'P10-04 test' }, token: t.tokenFor(admin) })).status).toBe(200);
    const token = (user: UserEntity, role: OrganizationMemberRoleEnum) =>
      t.tokenFor(user, { session_mode: 'organization', context_type: 'organization', organization_id: organization.id, member_role: role });
    const ownerToken = token(owner, OrganizationMemberRoleEnum.OWNER);
    const batch = async (name: string, students: UserEntity[]) => {
      const classId = (await call<{ id: string }>('POST', '/classes', ownerToken, { class_name: name })).body.payload.id;
      await call('POST', `/classes/${classId}/students`, ownerToken, { students: students.map((s) => s.email) });
      return (await call<{ id: string }[]>('GET', `/classes/${classId}/sections`, ownerToken)).body.payload[0].id;
    };
    const [mitu, rafi, other] = [await make.student({ full_name: 'Mitu' }), await make.student({ full_name: 'Rafi' }), await make.student({ full_name: 'Other' })];
    const sectionId = await batch('Band 7 Course', [mitu, rafi]);
    const otherSection = await batch('Band 6 Course', [other]);
    return {
      organization,
      owner,
      ownerToken,
      sectionId,
      otherSection,
      mituToken: token(mitu, OrganizationMemberRoleEnum.STUDENT),
      rafiToken: token(rafi, OrganizationMemberRoleEnum.STUDENT),
      otherToken: token(other, OrganizationMemberRoleEnum.STUDENT),
    };
  };
  type Centre = Awaited<ReturnType<typeof centre>>;

  /** Short answers "a1", "a2"…, one "Choose TWO" (B, D) and one TFNG (FALSE): 5 numbers per part. */
  const fill = async (s: Centre, testId: string, partId: string, module: string) => {
    if (module === 'READING') await call('PUT', `/ielts/tests/${testId}/parts/${partId}`, s.ownerToken, { content: '<p>Passage</p>' });
    if (module === 'LISTENING') {
      const audio = await t.dataSource.getRepository(FileObjectEntity).save({
        organization_id: s.organization.id,
        owner_id: s.owner.id,
        purpose: FilePurposeEnum.IELTS,
        s3_key: `k/${Math.random()}`,
        mime: 'audio/mpeg',
        original_name: 'a.mp3',
        size_bytes: 10,
        original_size_bytes: 10,
        status: FileStatusEnum.READY,
      } as DeepPartial<FileObjectEntity>);
      await call('PUT', `/ielts/tests/${testId}/parts/${partId}`, s.ownerToken, { audio_file_id: audio.id });
    }
    await call('POST', `/ielts/tests/${testId}/parts/${partId}/groups`, s.ownerToken, {
      type: 'SHORT_ANSWER',
      instruction: 'Write NO MORE THAN TWO WORDS.',
      word_limit: 2,
      questions: [1, 2].map((n) => ({ prompt: `Q${n}`, answer: { accepted: [`a${n}`] } })),
    });
    const options = ['A', 'B', 'C', 'D', 'E'].map((key) => ({ key, text: key }));
    await call('POST', `/ielts/tests/${testId}/parts/${partId}/groups`, s.ownerToken, { type: 'MCQ_MULTI', instruction: 'Choose TWO.', questions: [{ prompt: 'Which two?', options, answer: { keys: ['B', 'D'] } }] });
    if (module === 'READING') {
      await call('POST', `/ielts/tests/${testId}/parts/${partId}/groups`, s.ownerToken, { type: 'TFNG', instruction: 'Agree?', questions: [{ prompt: 'Claim', answer: { keys: ['FALSE'] } }] });
    }
  };

  /** A published Reading practice set (one passage, 5 numbers). */
  const practice = async (s: Centre) => {
    const test = (await call<Test>('POST', '/ielts/tests', s.ownerToken, { title: 'Passage practice', test_type: 'ACADEMIC', purpose: 'PRACTICE', module: 'READING', part_nos: [1] })).body.payload;
    await fill(s, test.id, test.parts[0].id, 'READING');
    expect((await call('POST', `/ielts/tests/${test.id}/publish`, s.ownerToken)).status).toBe(200);
    return test;
  };

  const open = (s: Centre, testId: string, extra: Record<string, unknown> = {}) =>
    call<{ id: string; students: number }>('POST', `/ielts/tests/${testId}/assignments`, s.ownerToken, { section_id: s.sectionId, opens_at: iso(-hour), closes_at: iso(hour), ...extra });

  beforeAll(async () => {
    t = await createTestApp();
    make = factories(t.dataSource);
    admin = await make.user(RolesEnum.SUPER_ADMIN);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterAll(async () => {
    await t.close();
  });

  it('opens only published tests, for a batch of the centre, in a real window', async () => {
    const s = await centre();
    const draft = (await call<Test>('POST', '/ielts/tests', s.ownerToken, { title: 'Draft', test_type: 'ACADEMIC', purpose: 'PRACTICE', module: 'READING', part_nos: [1] })).body.payload;
    expect((await open(s, draft.id)).body.code).toBe('IELTS_ASSIGNMENT_INVALID');
    const test = await practice(s);
    const opened = await open(s, test.id);
    expect(opened.status).toBe(201);
    expect(opened.body.payload).toMatchObject({ students: 2, section: { name: 'Band 7 Course A' } });
    expect((await open(s, test.id, { opens_at: iso(hour), closes_at: iso(-hour) })).body.code).toBe('IELTS_ASSIGNMENT_INVALID');
    const elsewhere = await centre();
    expect((await open(s, test.id, { section_id: elsewhere.sectionId })).body.code).toBe('IELTS_ASSIGNMENT_INVALID');
    expect((await call('POST', `/ielts/tests/${test.id}/assignments`, s.mituToken, { section_id: s.sectionId, opens_at: iso(-hour), closes_at: iso(hour) })).body.code).toBe('IELTS_STAFF_ONLY');
    expect((await call<unknown[]>('GET', `/ielts/tests/${test.id}/assignments`, s.ownerToken)).body.payload).toHaveLength(1);
  });

  it('lets a student take a Reading set: no answers on the paper, saved as they go, marked out of 40 with a band', async () => {
    const s = await centre();
    const test = await practice(s);
    const opening = (await open(s, test.id)).body.payload;

    const mine = (await call<Mine[]>('GET', '/ielts/my/assignments', s.mituToken)).body.payload;
    expect(mine.map((m) => [m.test.title, m.is_open])).toEqual([['Passage practice', true]]);
    expect((await call<Mine[]>('GET', '/ielts/my/assignments', s.otherToken)).body.payload).toEqual([]);
    expect((await call('POST', `/ielts/my/assignments/${opening.id}/modules/READING/start`, s.otherToken)).body.code).toBe('IELTS_ASSIGNMENT_NOT_FOUND');

    const started = await call<Attempt>('POST', `/ielts/my/assignments/${opening.id}/modules/READING/start`, s.mituToken);
    expect(started.status).toBe(200);
    const { attempt, parts } = started.body.payload;
    expect(attempt).toMatchObject({ status: 'IN_PROGRESS', review_seconds: 0 });
    expect(new Date(attempt.deadline).getTime() - Date.now()).toBeGreaterThan(19 * 60_000); // 20 minutes for one passage
    const questions = (parts ?? []).flatMap((p) => p.groups.flatMap((g) => g.questions));
    expect(questions.map((q) => q.number_from)).toEqual([1, 2, 3, 5]);
    expect(questions.some((q) => 'answer' in q || 'key' in q)).toBe(false);
    const [q1, q2, multi, tfng] = questions;

    expect((await call('PUT', `/ielts/my/attempts/${attempt.id}/answers`, s.mituToken, { answers: [{ question_id: q1.id, answer: ' A1 ' }, { question_id: q2.id, answer: 'wrong' }] })).status).toBe(200);
    // Resuming gives the same attempt with the saved answers.
    const resumed = (await call<Attempt>('POST', `/ielts/my/assignments/${opening.id}/modules/READING/start`, s.mituToken)).body.payload;
    expect(resumed.attempt.id).toBe(attempt.id);
    expect(resumed.answers).toEqual({ [q1.id]: 'A1', [q2.id]: 'wrong' });
    expect((await call('PUT', `/ielts/my/attempts/${attempt.id}/answers`, s.mituToken, { answers: [{ question_id: test.id, answer: 'x' }] })).body.code).toBe('IELTS_ANSWER_INVALID');
    expect((await call('PUT', `/ielts/my/attempts/${attempt.id}/answers`, s.rafiToken, { answers: [] })).body.code).toBe('IELTS_ATTEMPT_NOT_FOUND');

    const submitted = await call<Attempt>('POST', `/ielts/my/attempts/${attempt.id}/submit`, s.mituToken, { answers: [{ question_id: multi.id, answer: 'D,B' }, { question_id: tfng.id, answer: 'TRUE' }] });
    // a1 right, a2 wrong, B and D right (2), TFNG wrong: 3 of the set's 5 numbers, scaled to 24 of 40 → band 6.
    expect(submitted.body.payload.attempt).toMatchObject({ status: 'MARKED', raw_score: 3, raw_total: 5, band: 6 });
    // A practice set shows the right answers after hand-in.
    const reviewed = (submitted.body.payload.parts ?? []).flatMap((p) => p.groups.flatMap((g) => g.questions));
    expect(reviewed.map((q) => q.marks)).toEqual([1, 0, 2, 0]);
    expect(reviewed[3].key).toEqual({ keys: ['FALSE'] });

    expect((await call('POST', `/ielts/my/assignments/${opening.id}/modules/READING/start`, s.mituToken)).body.code).toBe('IELTS_ATTEMPT_DONE');
    expect((await call('PUT', `/ielts/my/attempts/${attempt.id}/answers`, s.mituToken, { answers: [] })).body.code).toBe('IELTS_ATTEMPT_DONE');

    const results = (await call<{ student: { full_name: string }; modules: Record<string, { band: number; raw_score: number; raw_total: number }> }[]>('GET', `/ielts/assignments/${opening.id}/results`, s.ownerToken)).body.payload;
    expect(results.map((r) => [r.student.full_name, r.modules.READING?.raw_score ?? null])).toEqual([['Mitu', 3], ['Rafi', null]]);
    expect(results[0].modules.READING).toMatchObject({ raw_total: 5, band: 6 });

    // Bands marked before this fix (as if out of 40) are corrected by the IeltsPracticeBands migration.
    await t.dataSource.query(`UPDATE ielts_attempts SET band = 2 WHERE id = $1`, [attempt.id]);
    const runner = t.dataSource.createQueryRunner();
    await new IeltsPracticeBands1756500000000().up(runner);
    await runner.release();
    expect((await t.dataSource.getRepository(IeltsAttemptEntity).findOneByOrFail({ id: attempt.id })).band).toBe('6.0');
    const listed = (await call<Mine[]>('GET', '/ielts/my/assignments', s.mituToken)).body.payload;
    expect(listed[0].attempts.READING).toMatchObject({ status: 'MARKED', raw_total: 5, band: 6 });
  });

  it('runs a mock in order, only while open, and hands in when time runs out', async () => {
    const s = await centre();
    const mock = (await call<Test>('POST', '/ielts/tests', s.ownerToken, { title: 'Mock', test_type: 'GENERAL', purpose: 'MOCK', modules: ['LISTENING', 'READING', 'WRITING'] })).body.payload;
    const lParts = mock.parts.filter((p) => p.module === 'LISTENING');
    const rParts = mock.parts.filter((p) => p.module === 'READING');
    for (const p of lParts) await fill(s, mock.id, p.id, 'LISTENING');
    for (const p of rParts) await fill(s, mock.id, p.id, 'READING');
    // Fill up to 40: Listening has 4 × 4 = 16 numbers, Reading 3 × 5 = 15.
    const more = (n: number) => ({ type: 'SHORT_ANSWER', instruction: 'Answer.', questions: Array.from({ length: n }, (_, i) => ({ prompt: `M${i}`, answer: { accepted: ['x'] } })) });
    await call('POST', `/ielts/tests/${mock.id}/parts/${lParts[3].id}/groups`, s.ownerToken, more(24));
    await call('POST', `/ielts/tests/${mock.id}/parts/${rParts[2].id}/groups`, s.ownerToken, more(25));
    for (const p of mock.parts.filter((x) => x.module === 'WRITING')) await call('PUT', `/ielts/tests/${mock.id}/parts/${p.id}`, s.ownerToken, { content: '<p>Write a letter.</p>' });
    expect((await call('POST', `/ielts/tests/${mock.id}/publish`, s.ownerToken)).status).toBe(200);

    const later = (await open(s, mock.id, { opens_at: iso(hour), closes_at: iso(2 * hour) })).body.payload;
    expect((await call('POST', `/ielts/my/assignments/${later.id}/modules/LISTENING/start`, s.mituToken)).body.code).toBe('IELTS_NOT_OPEN');

    const opening = (await open(s, mock.id)).body.payload;
    expect((await call('POST', `/ielts/my/assignments/${opening.id}/modules/READING/start`, s.mituToken)).body.code).toBe('IELTS_MODULE_ORDER');
    expect((await call('POST', `/ielts/my/assignments/${opening.id}/modules/SPEAKING/start`, s.mituToken)).body.code).toBe('IELTS_MODULE_NOT_READY');
    const listening = (await call<Attempt>('POST', `/ielts/my/assignments/${opening.id}/modules/LISTENING/start`, s.mituToken)).body.payload;
    expect(listening.attempt.review_seconds).toBe(120);
    expect(new Date(listening.attempt.deadline).getTime() - Date.now()).toBeGreaterThan(31 * 60_000); // 30 minutes + 2 to check
    const first = (listening.parts ?? [])[0].groups[0].questions[0];
    await call('PUT', `/ielts/my/attempts/${listening.attempt.id}/answers`, s.mituToken, { answers: [{ question_id: first.id, answer: 'a1' }] });

    // Time runs out: the module is handed in with what was saved.
    await t.dataSource.getRepository(IeltsAttemptEntity).update({ id: listening.attempt.id }, { deadline: new Date(Date.now() - 60_000) });
    const timedOut = (await call<Attempt>('GET', `/ielts/my/attempts/${listening.attempt.id}`, s.mituToken)).body.payload;
    expect(timedOut.attempt).toMatchObject({ status: 'MARKED', raw_score: 1 });
    // A mock's answers stay hidden until its window closes.
    expect(timedOut.parts).toBeNull();
    expect((await call('PUT', `/ielts/my/attempts/${listening.attempt.id}/answers`, s.mituToken, { answers: [] })).body.code).toBe('IELTS_ATTEMPT_DONE');

    const reading = await call<Attempt>('POST', `/ielts/my/assignments/${opening.id}/modules/READING/start`, s.mituToken);
    expect(reading.status).toBe(200);
    // Writing waits until Reading is handed in.
    expect((await call('POST', `/ielts/my/assignments/${opening.id}/modules/WRITING/start`, s.mituToken)).body.code).toBe('IELTS_MODULE_ORDER');
  });
});
