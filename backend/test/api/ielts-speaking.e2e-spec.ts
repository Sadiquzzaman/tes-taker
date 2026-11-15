import { DeepPartial } from 'typeorm';
import { RolesEnum } from '../../src/common/enums/roles.enum';
import { FileObjectEntity } from '../../src/files/entities/file-object.entity';
import { FilePurposeEnum, FileStatusEnum } from '../../src/files/file-rules';
import { OrganizationEntity } from '../../src/organizations/entities/organization.entity';
import { OrganizationKindEnum } from '../../src/organizations/enums/organization-kind.enum';
import { OrganizationMemberRoleEnum } from '../../src/organizations/enums/organization-member-role.enum';
import { WorkspaceTypeEnum } from '../../src/organizations/enums/workspace-type.enum';
import { UserEntity } from '../../src/user/entities/user.entity';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

type Body<T> = { payload: T; code?: string; message?: string };
type Test = { id: string; parts: { id: string; part_no: number }[] };
type Attempt = { attempt: { id: string; status: string; mode: string | null; band: number | null; recordings: Record<string, string>; criteria: { speaking?: Record<string, number> } | null; feedback: string | null }; parts: { id: string }[] | null };
type Marking = { attempt_id: string; status: string; mode: string | null; band: number | null; speaking: Record<string, number> | null; tasks: { part_no: number; recording_file_id: string | null }[] };

/**
 * Speaking (P10-06, IEL-07): a live session run by the examiner (recorded or not) and marked on
 * FC, LR, GRA and P; or practice recordings by the student, handed in and marked later. The band
 * is the four criteria averaged to the nearest half band.
 */
describe('IELTS Speaking', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;
  let admin: UserEntity;

  const call = <T>(method: string, path: string, token: string, body?: unknown) => t.api.request<Body<T>>(method, path, { token, body });
  const hour = 3_600_000;

  const centre = async () => {
    const owner = await make.teacher({ personal_teacher_enabled: false });
    const organization = await make.organization(owner);
    await t.dataSource.getRepository(OrganizationEntity).update({ id: organization.id }, { kind: OrganizationKindEnum.IELTS_CENTRE, workspace_type: WorkspaceTypeEnum.IELTS } as DeepPartial<OrganizationEntity>);
    expect((await t.api.request('PUT', `/subscriptions/admin/organizations/${organization.id}/overrides/ielts`, { body: { value: true, reason: 'P10-06 test' }, token: t.tokenFor(admin) })).status).toBe(200);
    const token = (user: UserEntity, role: OrganizationMemberRoleEnum) =>
      t.tokenFor(user, { session_mode: 'organization', context_type: 'organization', organization_id: organization.id, member_role: role });
    const ownerToken = token(owner, OrganizationMemberRoleEnum.OWNER);
    const [mitu, rafi] = [await make.student({ full_name: 'Mitu' }), await make.student({ full_name: 'Rafi' })];
    const classId = (await call<{ id: string }>('POST', '/classes', ownerToken, { class_name: 'Band 7 Course' })).body.payload.id;
    await call('POST', `/classes/${classId}/students`, ownerToken, { students: [mitu.email, rafi.email] });
    const sectionId = (await call<{ id: string }[]>('GET', `/classes/${classId}/sections`, ownerToken)).body.payload[0].id;
    const test = (await call<Test>('POST', '/ielts/tests', ownerToken, { title: 'Speaking practice', test_type: 'ACADEMIC', purpose: 'PRACTICE', module: 'SPEAKING', part_nos: [1, 2, 3] })).body.payload;
    for (const p of test.parts) await call('PUT', `/ielts/tests/${test.id}/parts/${p.id}`, ownerToken, { content: `<p>Part ${p.part_no} questions</p>` });
    expect((await call('POST', `/ielts/tests/${test.id}/publish`, ownerToken)).status).toBe(200);
    const opening = (await call<{ id: string }>('POST', `/ielts/tests/${test.id}/assignments`, ownerToken, { section_id: sectionId, opens_at: new Date(Date.now() - hour).toISOString(), closes_at: new Date(Date.now() + hour).toISOString() })).body.payload;
    const audio = (owner: UserEntity) =>
      t.dataSource.getRepository(FileObjectEntity).save({
        organization_id: organization.id,
        owner_id: owner.id,
        purpose: FilePurposeEnum.IELTS,
        s3_key: `k/${Math.random()}`,
        mime: 'audio/webm',
        original_name: 'part.webm',
        size_bytes: 10,
        original_size_bytes: 10,
        status: FileStatusEnum.READY,
      } as DeepPartial<FileObjectEntity>);
    return { owner, mitu, rafi, ownerToken, test, opening, audio, mituToken: token(mitu, OrganizationMemberRoleEnum.STUDENT), rafiToken: token(rafi, OrganizationMemberRoleEnum.STUDENT) };
  };

  beforeAll(async () => {
    t = await createTestApp();
    make = factories(t.dataSource);
    admin = await make.user(RolesEnum.SUPER_ADMIN);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterAll(async () => {
    await t.close();
  });

  it('runs a live session with the examiner, recorded, and marks the four criteria', async () => {
    const s = await centre();
    const session = await call<Marking>('POST', `/ielts/assignments/${s.opening.id}/speaking`, s.ownerToken, { student_id: s.mitu.id });
    expect(session.status).toBe(200);
    expect(session.body.payload).toMatchObject({ status: 'IN_PROGRESS', mode: 'LIVE' });
    const id = session.body.payload.attempt_id;
    // Starting again resumes it; the student cannot take it over.
    expect((await call<Marking>('POST', `/ielts/assignments/${s.opening.id}/speaking`, s.ownerToken, { student_id: s.mitu.id })).body.payload.attempt_id).toBe(id);
    expect((await call('POST', `/ielts/my/assignments/${s.opening.id}/modules/SPEAKING/start`, s.mituToken)).body.code).toBe('IELTS_ATTEMPT_DONE');

    const recording = await s.audio(s.owner);
    const recorded = (await call<Marking>('PUT', `/ielts/marking/${id}/recordings`, s.ownerToken, { part_id: s.test.parts[1].id, file_id: recording.id })).body.payload;
    expect(recorded.tasks.map((x) => x.recording_file_id)).toEqual([null, recording.id, null]);
    expect((await call('PUT', `/ielts/marking/${id}/recordings`, s.ownerToken, { part_id: s.test.id, file_id: recording.id })).body.code).toBe('IELTS_ANSWER_INVALID');

    expect((await call('PUT', `/ielts/marking/${id}/speaking`, s.ownerToken, { criteria: { FC: 6, LR: 6, GRA: 6 } })).body.code).toBe('IELTS_MARKS_INVALID');
    // 6.5, 6, 6, 7 → 6.375 → 6.5.
    const marked = await call<Marking>('PUT', `/ielts/marking/${id}/speaking`, s.ownerToken, { criteria: { FC: 6.5, LR: 6, GRA: 6, P: 7 }, feedback: 'Extend your Part 3 answers.' });
    expect(marked.body.payload).toMatchObject({ status: 'MARKED', band: 6.5, speaking: { FC: 6.5, LR: 6, GRA: 6, P: 7 } });

    const mine = (await call<{ attempts: Record<string, { id: string; band: number }> }[]>('GET', '/ielts/my/assignments', s.mituToken)).body.payload;
    expect(mine[0].attempts.SPEAKING.band).toBe(6.5);
    const result = (await call<Attempt>('GET', `/ielts/my/attempts/${id}`, s.mituToken)).body.payload;
    expect(result.attempt).toMatchObject({ mode: 'LIVE', band: 6.5, feedback: 'Extend your Part 3 answers.', recordings: { [s.test.parts[1].id]: recording.id } });
    // Not a student of this batch: not found.
    const outsider = await make.student();
    expect((await call('POST', `/ielts/assignments/${s.opening.id}/speaking`, s.ownerToken, { student_id: outsider.id })).body.code).toBe('IELTS_STUDENT_NOT_FOUND');
  });

  it('takes practice recordings from the student and marks them later', async () => {
    const s = await centre();
    const started = (await call<Attempt>('POST', `/ielts/my/assignments/${s.opening.id}/modules/SPEAKING/start`, s.rafiToken)).body.payload;
    expect(started.attempt).toMatchObject({ status: 'IN_PROGRESS', mode: 'RECORDED' });
    expect(started.parts).toHaveLength(3);
    const id = started.attempt.id;

    const mineAudio = await s.audio(s.rafi);
    const othersAudio = await s.audio(s.owner);
    expect((await call('PUT', `/ielts/my/attempts/${id}/recordings`, s.rafiToken, { part_id: s.test.parts[0].id, file_id: othersAudio.id })).body.code).toBe('IELTS_FILE_INVALID');
    const saved = (await call<Attempt>('PUT', `/ielts/my/attempts/${id}/recordings`, s.rafiToken, { part_id: s.test.parts[0].id, file_id: mineAudio.id })).body.payload;
    expect(saved.attempt.recordings).toEqual({ [s.test.parts[0].id]: mineAudio.id });
    // Staff do not record into a student's practice.
    expect((await call('PUT', `/ielts/marking/${id}/recordings`, s.ownerToken, { part_id: s.test.parts[0].id, file_id: othersAudio.id })).body.code).toBe('IELTS_NOT_HANDED_IN');

    const handedIn = (await call<Attempt>('POST', `/ielts/my/attempts/${id}/submit`, s.rafiToken, {})).body.payload;
    expect(handedIn.attempt).toMatchObject({ status: 'SUBMITTED', band: null });
    expect((await call('PUT', `/ielts/my/attempts/${id}/recordings`, s.rafiToken, { part_id: s.test.parts[1].id, file_id: mineAudio.id })).body.code).toBe('IELTS_ATTEMPT_DONE');

    const waiting = (await call<Marking[]>('GET', '/ielts/marking?module=SPEAKING', s.ownerToken)).body.payload;
    expect(waiting.map((w) => [w.attempt_id, w.mode])).toEqual([[id, undefined]]);
    const view = (await call<Marking>('GET', `/ielts/marking/${id}`, s.ownerToken)).body.payload;
    expect(view).toMatchObject({ mode: 'RECORDED' });
    expect(view.tasks[0].recording_file_id).toBe(mineAudio.id);
    const marked = await call<Marking>('PUT', `/ielts/marking/${id}/speaking`, s.ownerToken, { criteria: { FC: 5, LR: 5.5, GRA: 5, P: 5 } });
    expect(marked.body.payload.band).toBe(5); // 5.125 → 5
  });
});
