import { DeepPartial } from 'typeorm';
import { RolesEnum } from '../../src/common/enums/roles.enum';
import { IeltsAttemptEntity, IeltsAttemptStatusEnum } from '../../src/ielts/entities/ielts-attempt.entity';
import { IeltsModuleEnum } from '../../src/ielts/entities/ielts-profile.entity';
import { IeltsTestEntity, IeltsTestStatusEnum } from '../../src/ielts/entities/ielts-test.entity';
import { OrganizationEntity } from '../../src/organizations/entities/organization.entity';
import { OrganizationKindEnum } from '../../src/organizations/enums/organization-kind.enum';
import { OrganizationMemberRoleEnum } from '../../src/organizations/enums/organization-member-role.enum';
import { WorkspaceTypeEnum } from '../../src/organizations/enums/workspace-type.enum';
import { UserEntity } from '../../src/user/entities/user.entity';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

type Body<T> = { payload: T; code?: string };
type Test = { id: string; parts: { id: string; module: string }[] };

/**
 * IELTS progress and overviews (P10-07, IEL-01, IEL-08, IEL-09, IEL-10): the overall band of a
 * complete mock, bands over time, the weakest question types, the dashboards and the band report.
 */
describe('IELTS progress, dashboards and band report', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;
  let admin: UserEntity;

  const call = <T>(method: string, path: string, token: string, body?: unknown) => t.api.request<Body<T>>(method, path, { token, body });
  const hour = 3_600_000;

  beforeAll(async () => {
    t = await createTestApp();
    make = factories(t.dataSource);
    admin = await make.user(RolesEnum.SUPER_ADMIN);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterAll(async () => {
    await t.close();
  });

  it('works out overall bands, progress, weakest question types, dashboards and the report', async () => {
    const owner = await make.teacher({ personal_teacher_enabled: false });
    const organization = await make.organization(owner);
    await t.dataSource.getRepository(OrganizationEntity).update({ id: organization.id }, { kind: OrganizationKindEnum.IELTS_CENTRE, workspace_type: WorkspaceTypeEnum.IELTS } as DeepPartial<OrganizationEntity>);
    await t.api.request('PUT', `/subscriptions/admin/organizations/${organization.id}/overrides/ielts`, { body: { value: true, reason: 'P10-07 test' }, token: t.tokenFor(admin) });
    const token = (user: UserEntity, role: OrganizationMemberRoleEnum) =>
      t.tokenFor(user, { session_mode: 'organization', context_type: 'organization', organization_id: organization.id, member_role: role });
    const ownerToken = token(owner, OrganizationMemberRoleEnum.OWNER);
    const [mitu, rafi] = [await make.student({ full_name: 'Mitu' }), await make.student({ full_name: 'Rafi' })];
    const classId = (await call<{ id: string }>('POST', '/classes', ownerToken, { class_name: 'Band 7 Course' })).body.payload.id;
    await call('POST', `/classes/${classId}/students`, ownerToken, { students: [mitu.email, rafi.email] });
    const sectionId = (await call<{ id: string }[]>('GET', `/classes/${classId}/sections`, ownerToken)).body.payload[0].id;
    const mituToken = token(mitu, OrganizationMemberRoleEnum.STUDENT);
    await call('PUT', `/ielts/profiles/${mitu.id}`, ownerToken, { target_overall: 7, target_bands: { WRITING: 6.5 } });

    // A mock (published directly; its paper is not needed here) opened for the batch, with four marked modules.
    const mock = (await call<Test>('POST', '/ielts/tests', ownerToken, { title: 'Mock 1', test_type: 'ACADEMIC', purpose: 'MOCK' })).body.payload;
    await t.dataSource.getRepository(IeltsTestEntity).update({ id: mock.id }, { status: IeltsTestStatusEnum.PUBLISHED });
    const window = { section_id: sectionId, opens_at: new Date(Date.now() - hour).toISOString(), closes_at: new Date(Date.now() + 5 * hour).toISOString() };
    const opening = (await call<{ id: string }>('POST', `/ielts/tests/${mock.id}/assignments`, ownerToken, window)).body.payload;
    const bands: Record<IeltsModuleEnum, number> = { LISTENING: 7, READING: 6.5, WRITING: 6, SPEAKING: 6.5 }; // 6.5 average
    for (const [module, band] of Object.entries(bands)) {
      await t.dataSource.getRepository(IeltsAttemptEntity).save({
        organization_id: organization.id,
        test_id: mock.id,
        assignment_id: opening.id,
        student_id: mitu.id,
        module,
        status: IeltsAttemptStatusEnum.MARKED,
        started_at: new Date(Date.now() - hour),
        deadline: new Date(),
        submitted_at: new Date(),
        raw_score: module === 'LISTENING' || module === 'READING' ? 30 : null,
        band: band.toFixed(1),
        criteria: module === 'WRITING' ? { tasks: [{ part_no: 1, band: 6 }] } : null,
        feedback: module === 'WRITING' ? 'Plan your essay.' : null,
      } as DeepPartial<IeltsAttemptEntity>);
    }
    // Rafi handed in Writing: it waits for marks.
    await t.dataSource.getRepository(IeltsAttemptEntity).save({
      organization_id: organization.id, test_id: mock.id, assignment_id: opening.id, student_id: rafi.id, module: 'WRITING',
      status: IeltsAttemptStatusEnum.SUBMITTED, started_at: new Date(), deadline: new Date(Date.now() + hour), submitted_at: new Date(),
    } as DeepPartial<IeltsAttemptEntity>);

    // A Reading practice set taken for real: TFNG right, short answer wrong.
    const set = (await call<Test>('POST', '/ielts/tests', ownerToken, { title: 'Passage practice', test_type: 'ACADEMIC', purpose: 'PRACTICE', module: 'READING', part_nos: [1] })).body.payload;
    await call('PUT', `/ielts/tests/${set.id}/parts/${set.parts[0].id}`, ownerToken, { content: '<p>Passage</p>' });
    await call('POST', `/ielts/tests/${set.id}/parts/${set.parts[0].id}/groups`, ownerToken, { type: 'TFNG', instruction: 'Agree?', questions: [{ prompt: 'A', answer: { keys: ['TRUE'] } }] });
    await call('POST', `/ielts/tests/${set.id}/parts/${set.parts[0].id}/groups`, ownerToken, { type: 'SHORT_ANSWER', instruction: 'Answer.', questions: [1, 2].map((n) => ({ prompt: `Q${n}`, answer: { accepted: ['x'] } })) });
    await call('POST', `/ielts/tests/${set.id}/publish`, ownerToken);
    const setOpening = (await call<{ id: string }>('POST', `/ielts/tests/${set.id}/assignments`, ownerToken, window)).body.payload;
    const started = (await call<{ attempt: { id: string }; parts: { groups: { questions: { id: string }[] }[] }[] }>('POST', `/ielts/my/assignments/${setOpening.id}/modules/READING/start`, mituToken)).body.payload;
    const [tfng, sa1] = started.parts.flatMap((p) => p.groups.flatMap((g) => g.questions));
    await call('POST', `/ielts/my/attempts/${started.attempt.id}/submit`, mituToken, { answers: [{ question_id: tfng.id, answer: 'TRUE' }, { question_id: sa1.id, answer: 'nope' }] });

    // Results: the overall band once all four are marked.
    const results = (await call<{ student: { full_name: string }; overall: number | null }[]>('GET', `/ielts/assignments/${opening.id}/results`, ownerToken)).body.payload;
    expect(results.map((r) => [r.student.full_name, r.overall])).toEqual([['Mitu', 6.5], ['Rafi', null]]);

    // Progress: bands per module, the complete mock, weakest question types first.
    const progress = (await call<{ modules: Record<string, { band: number }[]>; mocks: { overall: number }[]; question_types: { type: string; percent: number; total: number }[]; profile: { target_overall: number } }>('GET', `/ielts/progress/${mitu.id}`, ownerToken)).body.payload;
    expect(progress.modules.READING.map((p) => p.band)).toEqual([6.5, expect.any(Number)]);
    expect(progress.mocks.map((m) => m.overall)).toEqual([6.5]);
    expect(progress.question_types.map((q) => [q.type, q.percent, q.total])).toEqual([['SHORT_ANSWER', 0, 2], ['TFNG', 100, 1]]);
    expect(progress.profile.target_overall).toBe(7);
    expect((await call('GET', `/ielts/progress/${rafi.id}`, mituToken)).status).toBe(404);
    expect((await call<{ mocks: unknown[] }>('GET', '/ielts/progress/me', mituToken)).body.payload.mocks).toHaveLength(1);

    // Dashboards.
    const staff = (await call<{ batches: number; students: number; upcoming: { test_title: string }[]; waiting: { writing: number }; batch_bands: { batch: string; bands: Record<string, number> }[] }>('GET', '/ielts/dashboard', ownerToken)).body.payload;
    expect(staff).toMatchObject({ batches: 1, students: 2, waiting: { writing: 1, speaking: 0 } });
    expect(staff.upcoming.map((u) => u.test_title)).toEqual(['Mock 1']);
    expect(staff.batch_bands[0]).toMatchObject({ batch: 'Band 7 Course A', bands: { LISTENING: 7, WRITING: 6 } });
    expect((await call('GET', '/ielts/dashboard', mituToken)).body.code).toBe('IELTS_STAFF_ONLY');
    const student = (await call<{ latest: Record<string, number>; next: { test_title: string } | null; profile: { target_overall: number } }>('GET', '/ielts/dashboard/me', mituToken)).body.payload;
    expect(student.latest).toMatchObject({ LISTENING: 7, WRITING: 6, SPEAKING: 6.5 });
    expect(student.next).toBeNull(); // both openings are done

    // The band report.
    const report = (await call<{ overall: number; modules: Record<string, { band: number; feedback: string | null }>; targets: { overall: number } }>('GET', `/ielts/report/${opening.id}/${mitu.id}`, ownerToken)).body.payload;
    expect(report).toMatchObject({ overall: 6.5, targets: { overall: 7 } });
    expect(report.modules.WRITING).toMatchObject({ band: 6, feedback: 'Plan your essay.' });
    expect((await call('GET', `/ielts/report/${opening.id}/${mitu.id}`, mituToken)).status).toBe(200);
    expect((await call<{ overall: number }>('GET', `/ielts/report/${opening.id}/me`, mituToken)).body.payload.overall).toBe(6.5);
    expect((await call('GET', `/ielts/report/${opening.id}/${rafi.id}`, mituToken)).status).toBe(404);
    const rafiReport = (await call<{ overall: number | null; modules: Record<string, { status: string; band: number | null }> }>('GET', `/ielts/report/${opening.id}/${rafi.id}`, ownerToken)).body.payload;
    expect(rafiReport.overall).toBeNull();
    expect(rafiReport.modules.WRITING).toMatchObject({ status: 'SUBMITTED', band: null });
  });
});
