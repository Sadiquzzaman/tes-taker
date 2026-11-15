import { DeepPartial } from 'typeorm';
import { AuditService } from '../../src/audit/audit.service';
import { AuditLogEntity } from '../../src/audit/entities/audit-log.entity';
import { RolesEnum } from '../../src/common/enums/roles.enum';
import { FileObjectEntity } from '../../src/files/entities/file-object.entity';
import { FilePurposeEnum, FileStatusEnum } from '../../src/files/file-rules';
import { IeltsTestEntity, IeltsTestStatusEnum } from '../../src/ielts/entities/ielts-test.entity';
import { OrganizationEntity } from '../../src/organizations/entities/organization.entity';
import { OrganizationKindEnum } from '../../src/organizations/enums/organization-kind.enum';
import { OrganizationMemberRoleEnum } from '../../src/organizations/enums/organization-member-role.enum';
import { WorkspaceTypeEnum } from '../../src/organizations/enums/workspace-type.enum';
import { UserEntity } from '../../src/user/entities/user.entity';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

type Body<T> = { payload: T; code?: string };
type Part = { id: string; module: string; part_no: number; title: string | null; content: string | null; audio_file_id: string | null; image_file_id: string | null; groups: unknown[] };
type Test = { id: string; title: string; test_type: string; purpose: string; modules: string[]; durations: Record<string, number>; status: string; can_edit: boolean; parts: Part[]; question_counts?: Record<string, number> };

/**
 * IELTS tests (P10-02, IEL-03): a mock gets the real template, a practice set the chosen parts of
 * one module; staff see the centre's tests, the maker / owners / admins change drafts; parts take
 * their text, a Listening recording or a picture; deleting keeps the row.
 */
describe('IELTS tests', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;
  let admin: UserEntity;

  const call = <T>(method: string, path: string, token: string, body?: unknown) => t.api.request<Body<T>>(method, path, { token, body });

  const centre = async ({ ielts = true } = {}) => {
    const owner = await make.teacher({ personal_teacher_enabled: false });
    const organization = await make.organization(owner);
    if (ielts) {
      await t.dataSource.getRepository(OrganizationEntity).update({ id: organization.id }, { kind: OrganizationKindEnum.IELTS_CENTRE, workspace_type: WorkspaceTypeEnum.IELTS } as DeepPartial<OrganizationEntity>);
    }
    expect((await t.api.request('PUT', `/subscriptions/admin/organizations/${organization.id}/overrides/ielts`, { body: { value: true, reason: 'P10-02 test' }, token: t.tokenFor(admin) })).status).toBe(200);
    const token = (user: UserEntity, role: OrganizationMemberRoleEnum) =>
      t.tokenFor(user, { session_mode: 'organization', context_type: 'organization', organization_id: organization.id, member_role: role });
    const [tania, rafiq, student] = [await make.teacher(), await make.teacher(), await make.student()];
    await make.member(organization, tania, OrganizationMemberRoleEnum.TEACHER);
    await make.member(organization, rafiq, OrganizationMemberRoleEnum.TEACHER);
    await make.member(organization, student, OrganizationMemberRoleEnum.STUDENT);
    return {
      organization,
      tania,
      ownerToken: token(owner, OrganizationMemberRoleEnum.OWNER),
      taniaToken: token(tania, OrganizationMemberRoleEnum.TEACHER),
      rafiqToken: token(rafiq, OrganizationMemberRoleEnum.TEACHER),
      studentToken: token(student, OrganizationMemberRoleEnum.STUDENT),
    };
  };

  const upload = (organizationId: string, ownerId: string, mime: string, purpose = FilePurposeEnum.IELTS) =>
    t.dataSource.getRepository(FileObjectEntity).save({
      organization_id: organizationId,
      owner_id: ownerId,
      purpose,
      s3_key: `org/${organizationId}/ielts/${Math.random()}`,
      mime,
      original_name: 'file',
      size_bytes: 3000,
      original_size_bytes: 3000,
      status: FileStatusEnum.READY,
    } as DeepPartial<FileObjectEntity>);

  beforeAll(async () => {
    t = await createTestApp();
    make = factories(t.dataSource);
    admin = await make.user(RolesEnum.SUPER_ADMIN);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterAll(async () => {
    await t.close();
  });

  it('makes a mock from the real template and a practice set from chosen parts', async () => {
    const s = await centre();
    const mock = await call<Test>('POST', '/ielts/tests', s.taniaToken, { title: ' Mock 1 ', test_type: 'ACADEMIC', purpose: 'MOCK' });
    expect(mock.status).toBe(201);
    expect(mock.body.payload).toMatchObject({ title: 'Mock 1', status: 'DRAFT', can_edit: true, modules: ['LISTENING', 'READING', 'WRITING', 'SPEAKING'], durations: { LISTENING: 1800, READING: 3600, WRITING: 3600, SPEAKING: 840 } });
    expect(mock.body.payload.parts.map((p) => `${p.module[0]}${p.part_no}`)).toEqual(['L1', 'L2', 'L3', 'L4', 'R1', 'R2', 'R3', 'W1', 'W2', 'S1', 'S2', 'S3']);

    // A mock of some modules keeps test order whatever order they were sent in.
    const lr = await call<Test>('POST', '/ielts/tests', s.taniaToken, { title: 'Mock 2', test_type: 'GENERAL', purpose: 'MOCK', modules: ['READING', 'LISTENING'] });
    expect(lr.body.payload.modules).toEqual(['LISTENING', 'READING']);
    expect(lr.body.payload.parts).toHaveLength(7);

    const practice = await call<Test>('POST', '/ielts/tests', s.taniaToken, { title: 'Task 2 practice', test_type: 'ACADEMIC', purpose: 'PRACTICE', module: 'WRITING', part_nos: [2] });
    expect(practice.body.payload).toMatchObject({ modules: ['WRITING'], durations: { WRITING: 2400 } });
    expect(practice.body.payload.parts.map((p) => p.part_no)).toEqual([2]);

    for (const bad of [
      { purpose: 'PRACTICE', module: 'READING', part_nos: [4] },
      { purpose: 'PRACTICE', module: 'READING' },
      { purpose: 'PRACTICE', modules: ['READING'], module: 'READING', part_nos: [1] },
      { purpose: 'MOCK', module: 'READING', part_nos: [1] },
    ]) {
      expect((await call('POST', '/ielts/tests', s.taniaToken, { title: 'X', test_type: 'ACADEMIC', ...bad })).body.code).toBe('IELTS_TEST_INVALID');
    }
    expect((await call('POST', '/ielts/tests', s.studentToken, { title: 'X', test_type: 'ACADEMIC', purpose: 'MOCK' })).body.code).toBe('IELTS_STAFF_ONLY');

    const list = (await call<Test[]>('GET', '/ielts/tests?purpose=MOCK', s.rafiqToken)).body.payload;
    expect(list.map((x) => x.title).sort()).toEqual(['Mock 1', 'Mock 2']);
    expect(list[0].question_counts).toEqual({});
  });

  it('lets the maker, owners and admins change drafts; others only read', async () => {
    const s = await centre();
    const test = (await call<Test>('POST', '/ielts/tests', s.taniaToken, { title: 'Mock', test_type: 'ACADEMIC', purpose: 'MOCK', modules: ['LISTENING', 'WRITING'] })).body.payload;
    const asRafiq = await call<Test>('GET', `/ielts/tests/${test.id}`, s.rafiqToken);
    expect(asRafiq.body.payload.can_edit).toBe(false);
    expect((await call('PATCH', `/ielts/tests/${test.id}`, s.rafiqToken, { title: 'Mine now' })).body.code).toBe('IELTS_TEST_NOT_YOURS');

    const saved = await call<Test>('PATCH', `/ielts/tests/${test.id}`, s.ownerToken, { title: 'Mock A', test_type: 'GENERAL', durations: { LISTENING: 2000 } });
    expect(saved.body.payload).toMatchObject({ title: 'Mock A', test_type: 'GENERAL', durations: { LISTENING: 2000, WRITING: 3600 } });
    for (const durations of [{ READING: 3600 }, { LISTENING: 30 }, { LISTENING: 20_000 }, { LISTENING: 100.5 }]) {
      expect((await call('PATCH', `/ielts/tests/${test.id}`, s.taniaToken, { durations })).body.code).toBe('IELTS_TEST_INVALID');
    }

    // Published tests keep their layout; only the title changes.
    await t.dataSource.getRepository(IeltsTestEntity).update({ id: test.id }, { status: IeltsTestStatusEnum.PUBLISHED });
    expect((await call('PATCH', `/ielts/tests/${test.id}`, s.taniaToken, { durations: { LISTENING: 1800 } })).body.code).toBe('IELTS_TEST_LOCKED');
    expect((await call('PUT', `/ielts/tests/${test.id}/parts/${test.parts[0].id}`, s.taniaToken, { title: 'Part 1' })).body.code).toBe('IELTS_TEST_LOCKED');
    expect((await call<Test>('PATCH', `/ielts/tests/${test.id}`, s.taniaToken, { title: 'Mock B' })).body.payload.title).toBe('Mock B');

    // Another centre cannot see it.
    const other = await centre();
    expect((await call('GET', `/ielts/tests/${test.id}`, other.ownerToken)).body.code).toBe('IELTS_TEST_NOT_FOUND');
  });

  it('keeps a part’s text, Listening recording and Writing picture', async () => {
    const s = await centre();
    const test = (await call<Test>('POST', '/ielts/tests', s.taniaToken, { title: 'Mock', test_type: 'ACADEMIC', purpose: 'MOCK' })).body.payload;
    const part = (module: string, no: number) => test.parts.find((p) => p.module === module && p.part_no === no) as Part;
    const audio = await upload(s.organization.id, s.tania.id, 'audio/mpeg');
    const chart = await upload(s.organization.id, s.tania.id, 'image/png');

    const listening = await call<Test>('PUT', `/ielts/tests/${test.id}/parts/${part('LISTENING', 1).id}`, s.taniaToken, { title: 'Booking a hotel', audio_file_id: audio.id });
    expect(listening.status).toBe(200);
    expect(listening.body.payload.parts[0]).toMatchObject({ title: 'Booking a hotel', audio_file_id: audio.id });
    const writing = await call<Test>('PUT', `/ielts/tests/${test.id}/parts/${part('WRITING', 1).id}`, s.taniaToken, { content: '<p>The chart below shows…</p>', image_file_id: chart.id });
    expect(writing.body.payload.parts.find((p) => p.module === 'WRITING' && p.part_no === 1)).toMatchObject({ content: '<p>The chart below shows…</p>', image_file_id: chart.id });

    // The right kind of file, uploaded for IELTS in this centre, on the right part.
    const resourceAudio = await upload(s.organization.id, s.tania.id, 'audio/mpeg', FilePurposeEnum.RESOURCE);
    const elsewhere = await centre();
    const foreign = await upload(elsewhere.organization.id, s.tania.id, 'audio/mpeg');
    for (const [partId, body] of [
      [part('LISTENING', 2).id, { audio_file_id: chart.id }],
      [part('LISTENING', 2).id, { audio_file_id: resourceAudio.id }],
      [part('LISTENING', 2).id, { audio_file_id: foreign.id }],
      [part('WRITING', 2).id, { image_file_id: audio.id }],
    ] as const) {
      expect((await call('PUT', `/ielts/tests/${test.id}/parts/${partId}`, s.taniaToken, body)).body.code).toBe('IELTS_FILE_INVALID');
    }
    expect((await call('PUT', `/ielts/tests/${test.id}/parts/${part('READING', 1).id}`, s.taniaToken, { audio_file_id: audio.id })).body.code).toBe('IELTS_TEST_INVALID');
    expect((await call('PUT', `/ielts/tests/${test.id}/parts/${part('SPEAKING', 2).id}`, s.taniaToken, { image_file_id: chart.id })).body.code).toBe('IELTS_TEST_INVALID');
    // Clearing a recording.
    const cleared = await call<Test>('PUT', `/ielts/tests/${test.id}/parts/${part('LISTENING', 1).id}`, s.taniaToken, { audio_file_id: null });
    expect(cleared.body.payload.parts[0].audio_file_id).toBeNull();
  });

  it('deletes a test by hiding it (the row is kept and audited)', async () => {
    const s = await centre();
    const test = (await call<Test>('POST', '/ielts/tests', s.taniaToken, { title: 'Old mock', test_type: 'ACADEMIC', purpose: 'MOCK' })).body.payload;
    expect((await call('DELETE', `/ielts/tests/${test.id}`, s.rafiqToken)).body.code).toBe('IELTS_TEST_NOT_YOURS');
    expect((await call('DELETE', `/ielts/tests/${test.id}`, s.taniaToken)).status).toBe(200);
    expect((await call<Test[]>('GET', '/ielts/tests', s.taniaToken)).body.payload).toEqual([]);
    expect((await call('GET', `/ielts/tests/${test.id}`, s.taniaToken)).status).toBe(404);
    const row = await t.dataSource.getRepository(IeltsTestEntity).findOneByOrFail({ id: test.id });
    expect(row.deleted_by).toBe(s.tania.id);
    await t.app.get(AuditService).flush();
    expect(await t.dataSource.getRepository(AuditLogEntity).count({ where: { organization_id: s.organization.id, action: 'ielts.test_delete' } })).toBe(1);
  });

  it('answers only in IELTS centres', async () => {
    const school = await centre({ ielts: false });
    const res = await call('GET', '/ielts/tests', school.ownerToken);
    expect([res.status, res.body.code]).toEqual([403, 'IELTS_ONLY_CENTRES']);
  });
});
