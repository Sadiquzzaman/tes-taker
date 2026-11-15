import { DeepPartial } from 'typeorm';
import { AuditService } from '../../src/audit/audit.service';
import { AuditLogEntity } from '../../src/audit/entities/audit-log.entity';
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
type Attempt = { attempt: { id: string; status: string; band: number | null; criteria: { tasks: { band: number }[] } | null; feedback: string | null }; parts: { id: string; content: string | null }[] | null; answers: Record<string, string> };
type Marking = {
  attempt_id: string;
  status: string;
  band: number | null;
  student: { full_name: string };
  batch: string;
  tasks: { part_no: number; script: string; words: number; min_words: number }[];
  marks: { part_no: number; band: number; criteria: Record<string, number>; comment: string | null }[];
  feedback: string | null;
};

/**
 * Writing (P10-05, IEL-06): students write each task on screen (scripts saved per task); handing
 * in waits for marks; staff mark the four criteria per task; a task's band is the criteria
 * averaged to the nearest half band and the Writing band counts Task 2 double.
 */
describe('IELTS Writing and marking', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;
  let admin: UserEntity;

  const call = <T>(method: string, path: string, token: string, body?: unknown) => t.api.request<Body<T>>(method, path, { token, body });
  const hour = 3_600_000;

  const centre = async () => {
    const owner = await make.teacher({ personal_teacher_enabled: false });
    const organization = await make.organization(owner);
    await t.dataSource.getRepository(OrganizationEntity).update({ id: organization.id }, { kind: OrganizationKindEnum.IELTS_CENTRE, workspace_type: WorkspaceTypeEnum.IELTS } as DeepPartial<OrganizationEntity>);
    expect((await t.api.request('PUT', `/subscriptions/admin/organizations/${organization.id}/overrides/ielts`, { body: { value: true, reason: 'P10-05 test' }, token: t.tokenFor(admin) })).status).toBe(200);
    const token = (user: UserEntity, role: OrganizationMemberRoleEnum) =>
      t.tokenFor(user, { session_mode: 'organization', context_type: 'organization', organization_id: organization.id, member_role: role });
    const ownerToken = token(owner, OrganizationMemberRoleEnum.OWNER);
    const mitu = await make.student({ full_name: 'Mitu' });
    const classId = (await call<{ id: string }>('POST', '/classes', ownerToken, { class_name: 'Band 7 Course' })).body.payload.id;
    await call('POST', `/classes/${classId}/students`, ownerToken, { students: [mitu.email] });
    const sectionId = (await call<{ id: string }[]>('GET', `/classes/${classId}/sections`, ownerToken)).body.payload[0].id;
    const teacher = await make.teacher();
    await make.member(organization, teacher, OrganizationMemberRoleEnum.TEACHER);
    return { organization, owner, ownerToken, sectionId, teacherToken: token(teacher, OrganizationMemberRoleEnum.TEACHER), mituToken: token(mitu, OrganizationMemberRoleEnum.STUDENT) };
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

  it('takes Writing on screen, waits for marks, and marks the four criteria per task', async () => {
    const s = await centre();
    const test = (await call<Test>('POST', '/ielts/tests', s.ownerToken, { title: 'Writing practice', test_type: 'ACADEMIC', purpose: 'PRACTICE', module: 'WRITING', part_nos: [1, 2] })).body.payload;
    const [task1, task2] = test.parts;
    const chart = await t.dataSource.getRepository(FileObjectEntity).save({
      organization_id: s.organization.id,
      owner_id: s.owner.id,
      purpose: FilePurposeEnum.IELTS,
      s3_key: `k/${Math.random()}`,
      mime: 'image/png',
      original_name: 'chart.png',
      size_bytes: 10,
      original_size_bytes: 10,
      status: FileStatusEnum.READY,
    } as DeepPartial<FileObjectEntity>);
    await call('PUT', `/ielts/tests/${test.id}/parts/${task1.id}`, s.ownerToken, { content: '<p>The chart shows…</p>', image_file_id: chart.id });
    await call('PUT', `/ielts/tests/${test.id}/parts/${task2.id}`, s.ownerToken, { content: '<p>Some people think…</p>' });
    expect((await call('POST', `/ielts/tests/${test.id}/publish`, s.ownerToken)).status).toBe(200);
    const opening = (await call<{ id: string }>('POST', `/ielts/tests/${test.id}/assignments`, s.ownerToken, { section_id: s.sectionId, opens_at: new Date(Date.now() - hour).toISOString(), closes_at: new Date(Date.now() + hour).toISOString() })).body.payload;

    const started = (await call<Attempt>('POST', `/ielts/my/assignments/${opening.id}/modules/WRITING/start`, s.mituToken)).body.payload;
    expect(started.parts?.map((p) => p.content)).toEqual(['<p>The chart shows…</p>', '<p>Some people think…</p>']);
    const id = started.attempt.id;
    const script1 = 'The chart shows how sales rose over ten years.\nOverall, sales doubled.';
    expect((await call('PUT', `/ielts/my/attempts/${id}/answers`, s.mituToken, { answers: [{ part_id: task1.id, answer: script1 }] })).status).toBe(200);
    // Scripts go to tasks, not questions; nothing longer than 20 000 characters.
    expect((await call('PUT', `/ielts/my/attempts/${id}/answers`, s.mituToken, { answers: [{ question_id: task1.id, answer: 'x' }] })).body.code).toBe('IELTS_ANSWER_INVALID');
    expect((await call('PUT', `/ielts/my/attempts/${id}/answers`, s.mituToken, { answers: [{ part_id: test.id, answer: 'x' }] })).body.code).toBe('IELTS_ANSWER_INVALID');
    const resumed = (await call<Attempt>('GET', `/ielts/my/attempts/${id}`, s.mituToken)).body.payload;
    expect(resumed.answers[task1.id]).toBe(script1);

    const handedIn = (await call<Attempt>('POST', `/ielts/my/attempts/${id}/submit`, s.mituToken, { answers: [{ part_id: task2.id, answer: 'In my opinion, both views have merit.' }] })).body.payload;
    expect(handedIn.attempt).toMatchObject({ status: 'SUBMITTED', band: null, criteria: null });

    // Staff see it waiting, with scripts and word counts beside the tasks.
    const waiting = (await call<Marking[]>('GET', '/ielts/marking', s.teacherToken)).body.payload;
    expect(waiting.map((w) => [w.student.full_name, w.batch, w.status])).toEqual([['Mitu', 'Band 7 Course A', 'SUBMITTED']]);
    const view = (await call<Marking>('GET', `/ielts/marking/${id}`, s.teacherToken)).body.payload;
    expect(view.tasks.map((x) => [x.part_no, x.words, x.min_words])).toEqual([[1, 12, 150], [2, 7, 250]]);
    expect((await call('GET', '/ielts/marking', s.mituToken)).body.code).toBe('IELTS_STAFF_ONLY');

    const bad = async (tasks: unknown) => (await call('PUT', `/ielts/marking/${id}/writing`, s.teacherToken, { tasks })).body.code;
    expect(await bad([{ part_id: task1.id, criteria: { TA: 6, CC: 6, LR: 6, GRA: 6 } }])).toBe('IELTS_MARKS_INVALID'); // Task 2 missing
    expect(await bad([{ part_id: task1.id, criteria: { TR: 6, CC: 6, LR: 6, GRA: 6 } }, { part_id: task2.id, criteria: { TR: 6, CC: 6, LR: 6, GRA: 6 } }])).toBe('IELTS_MARKS_INVALID'); // Task 1 is TA
    expect(await bad([{ part_id: task1.id, criteria: { TA: 6.2, CC: 6, LR: 6, GRA: 6 } }, { part_id: task2.id, criteria: { TR: 6, CC: 6, LR: 6, GRA: 6 } }])).toBe('IELTS_MARKS_INVALID');

    // Task 1: 6, 6, 5.5, 5.5 → 5.75 → 6; Task 2: 7, 7, 6.5, 6.5 → 6.75 → 7; Writing (6 + 2 × 7) / 3 = 6.67 → 6.5.
    const marked = await call<Marking>('PUT', `/ielts/marking/${id}/writing`, s.teacherToken, {
      tasks: [
        { part_id: task1.id, criteria: { TA: 6, CC: 6, LR: 5.5, GRA: 5.5 }, comment: 'Add an overview.' },
        { part_id: task2.id, criteria: { TR: 7, CC: 7, LR: 6.5, GRA: 6.5 } },
      ],
      feedback: 'Good progress.',
    });
    expect(marked.status).toBe(200);
    expect(marked.body.payload).toMatchObject({ status: 'MARKED', band: 6.5, feedback: 'Good progress.' });
    expect(marked.body.payload.marks.map((m) => [m.part_no, m.band, m.comment])).toEqual([[1, 6, 'Add an overview.'], [2, 7, null]]);

    // The student sees the band, criteria and feedback; it leaves the waiting list.
    const result = (await call<Attempt>('GET', `/ielts/my/attempts/${id}`, s.mituToken)).body.payload;
    expect(result.attempt).toMatchObject({ status: 'MARKED', band: 6.5, feedback: 'Good progress.' });
    expect(result.attempt.criteria?.tasks.map((x) => x.band)).toEqual([6, 7]);
    expect((await call<Marking[]>('GET', '/ielts/marking', s.teacherToken)).body.payload).toEqual([]);
    expect((await call<Marking[]>('GET', '/ielts/marking?state=MARKED', s.teacherToken)).body.payload).toHaveLength(1);

    // Marks can be changed later; each change is audited.
    await call('PUT', `/ielts/marking/${id}/writing`, s.ownerToken, {
      tasks: [
        { part_id: task1.id, criteria: { TA: 7, CC: 7, LR: 7, GRA: 7 } },
        { part_id: task2.id, criteria: { TR: 7, CC: 7, LR: 7, GRA: 7 } },
      ],
    });
    expect((await call<Marking>('GET', `/ielts/marking/${id}`, s.teacherToken)).body.payload.band).toBe(7);
    await t.app.get(AuditService).flush();
    expect(await t.dataSource.getRepository(AuditLogEntity).count({ where: { organization_id: s.organization.id, action: 'ielts.mark' } })).toBe(2);
  });

  it('does not mark what is not handed in', async () => {
    const s = await centre();
    const test = (await call<Test>('POST', '/ielts/tests', s.ownerToken, { title: 'Task 2', test_type: 'GENERAL', purpose: 'PRACTICE', module: 'WRITING', part_nos: [2] })).body.payload;
    await call('PUT', `/ielts/tests/${test.id}/parts/${test.parts[0].id}`, s.ownerToken, { content: '<p>Discuss.</p>' });
    await call('POST', `/ielts/tests/${test.id}/publish`, s.ownerToken);
    const opening = (await call<{ id: string }>('POST', `/ielts/tests/${test.id}/assignments`, s.ownerToken, { section_id: s.sectionId, opens_at: new Date(Date.now() - hour).toISOString(), closes_at: new Date(Date.now() + hour).toISOString() })).body.payload;
    const started = (await call<Attempt>('POST', `/ielts/my/assignments/${opening.id}/modules/WRITING/start`, s.mituToken)).body.payload;
    expect((await call('GET', `/ielts/marking/${started.attempt.id}`, s.teacherToken)).body.code).toBe('IELTS_NOT_HANDED_IN');
    // A single-task set's band is that task's band.
    await call('POST', `/ielts/my/attempts/${started.attempt.id}/submit`, s.mituToken, {});
    const marked = await call<Marking>('PUT', `/ielts/marking/${started.attempt.id}/writing`, s.teacherToken, { tasks: [{ part_id: test.parts[0].id, criteria: { TR: 5, CC: 5.5, LR: 5, GRA: 5.5 } }] });
    expect(marked.body.payload.band).toBe(5.5); // 5.25 → 5.5
  });
});
