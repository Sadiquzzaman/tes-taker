import { randomUUID } from 'crypto';
import { DeepPartial } from 'typeorm';
import { SubjectEntity } from '../../src/subjects/entities/subject.entity';
import { AuditService } from '../../src/audit/audit.service';
import { AuditLogEntity } from '../../src/audit/entities/audit-log.entity';
import { RolesEnum } from '../../src/common/enums/roles.enum';
import { OrganizationEntity } from '../../src/organizations/entities/organization.entity';
import { OrganizationKindEnum } from '../../src/organizations/enums/organization-kind.enum';
import { OrganizationMemberRoleEnum } from '../../src/organizations/enums/organization-member-role.enum';
import { WorkspaceTypeEnum } from '../../src/organizations/enums/workspace-type.enum';
import { UserEntity } from '../../src/user/entities/user.entity';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

type Body<T> = { payload: T; code?: string };
type Report = {
  check: { id: string; ran_by: string | null; submissions: number } | null;
  thresholds: { high: number; medium: number; min_words: number };
  submissions: { student: { full_name: string }; percent: number; level: string | null; not_checked: string | null; part_no: number | null; most_similar: { match_id: string; student: { full_name: string } }[] }[];
  matches: { id: string; score: number; level: string; part_no: number | null }[];
};
type Match = { a: { text: string; spans: { start: number; end: number }[] }; b: { text: string }; review_decision: string | null; review_note: string | null };

/**
 * Plagiarism checks (P10-09, PLG-01–03): classmates' homework texts and IELTS Writing scripts
 * compared, matching passages side by side, teacher review, thresholds; staff only.
 */
describe('Plagiarism checks', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;
  let admin: UserEntity;

  const call = <T>(method: string, path: string, token: string, body?: unknown) => t.api.request<Body<T>>(method, path, { token, body });
  const essay = (topic: string) =>
    `The ${topic} changed the way people lived and worked in many cities across the country during the last century and it brought new machines new jobs and new problems for families who moved from villages to towns in search of work and a better life for their children while factories grew quickly along the rivers and railways`;
  const own = (n: number) => Array.from({ length: 60 }, (_, i) => `word${n}x${i}`).join(' ');

  const enable = (organizationId: string, key: string) => t.api.request('PUT', `/subscriptions/admin/organizations/${organizationId}/overrides/${key}`, { body: { value: true, reason: 'P10-09 test' }, token: t.tokenFor(admin) });

  beforeAll(async () => {
    t = await createTestApp();
    make = factories(t.dataSource);
    admin = await make.user(RolesEnum.SUPER_ADMIN);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterAll(async () => {
    await t.close();
  });

  it('compares homework texts, shows passages side by side, and records the teacher’s review', async () => {
    const owner = await make.teacher({ personal_teacher_enabled: false });
    const organization = await make.organization(owner);
    await enable(organization.id, 'integrity');
    const token = (user: UserEntity, role: OrganizationMemberRoleEnum) =>
      t.tokenFor(user, { session_mode: 'organization', context_type: 'organization', organization_id: organization.id, member_role: role });
    const ownerToken = token(owner, OrganizationMemberRoleEnum.OWNER);
    await t.api.request('POST', '/classes', { token: ownerToken, body: { class_name: 'Class 9' } });
    const [{ id: sessionId }] = await t.dataSource.query(`SELECT id FROM academic_sessions WHERE organization_id = $1 LIMIT 1`, [organization.id]);
    const subject = await t.dataSource.getRepository(SubjectEntity).save({ name: 'English', code: 'ENG', organization_id: organization.id } as DeepPartial<SubjectEntity>);
    const homeworkId = randomUUID();
    await t.dataSource.query(
      `INSERT INTO homework (id, organization_id, session_id, subject_id, title, submission_type, due_at, created_by) VALUES ($1, $2, $3, $4, 'Essay', 'TEXT', now() - interval '1 day', $5)`,
      [homeworkId, organization.id, sessionId, subject.id, owner.id],
    );
    const [ana, bina, chan, dipu] = [await make.student({ full_name: 'Ana' }), await make.student({ full_name: 'Bina' }), await make.student({ full_name: 'Chan' }), await make.student({ full_name: 'Dipu' })];
    const submit = (student: UserEntity, text: string | null, version = 1) =>
      t.dataSource.query(
        `INSERT INTO homework_submissions (id, organization_id, homework_id, student_id, version, text_answer, submitted_at) VALUES ($1, $2, $3, $4, $5, $6, now()) RETURNING id`,
        [randomUUID(), organization.id, homeworkId, student.id, version, text],
      );
    await submit(ana, `<p>${essay('industrial revolution')}</p>`);
    await submit(bina, own(1), 1);
    await submit(bina, `${essay('industrial revolution')} ${own(2)}`, 2); // the latest version counts
    await submit(chan, 'Too short to check.');
    await submit(dipu, own(3));

    // The due date has passed: opening the results runs the check by itself.
    const scope = `scope_type=HOMEWORK&scope_id=${homeworkId}`;
    const report = (await call<Report>('GET', `/integrity/checks/latest?${scope}`, ownerToken)).body.payload;
    expect(report.check).toMatchObject({ ran_by: null, submissions: 3 });
    expect(report.thresholds).toEqual({ high: 40, medium: 20, min_words: 50 });
    expect(report.submissions.map((s) => [s.student.full_name, s.level, s.not_checked])).toEqual([
      ['Ana', 'HIGH', null],
      ['Bina', 'HIGH', null],
      ['Dipu', 'LOW', null],
      ['Chan', null, 'TOO_SHORT'],
    ]);
    expect(report.submissions[0]).toMatchObject({ percent: 100, most_similar: [{ student: { full_name: 'Bina' } }] });
    expect(report.matches).toHaveLength(1);

    const matchId = report.matches[0].id;
    const side = (await call<Match>('GET', `/integrity/matches/${matchId}`, ownerToken)).body.payload;
    expect(side.a.text.startsWith('The industrial revolution')).toBe(true); // HTML removed
    expect(side.a.text.slice(side.a.spans[0].start, side.a.spans[0].end)).toContain('changed the way people lived');

    const reviewed = (await call<Match>('PUT', `/integrity/matches/${matchId}/review`, ownerToken, { decision: 'COPIED', note: 'Same essay.' })).body.payload;
    expect(reviewed).toMatchObject({ review_decision: 'COPIED', review_note: 'Same essay.' });
    await t.app.get(AuditService).flush();
    expect(await t.dataSource.getRepository(AuditLogEntity).count({ where: { organization_id: organization.id, action: 'integrity.review' } })).toBe(1);

    // Running again makes a new check; students and teachers without the homework get nothing.
    expect((await call<Report>('POST', '/integrity/checks', ownerToken, { scope_type: 'HOMEWORK', scope_id: homeworkId })).body.payload.check?.ran_by).toBe(owner.id);
    await make.member(organization, ana, OrganizationMemberRoleEnum.STUDENT);
    const student = token(ana, OrganizationMemberRoleEnum.STUDENT);
    expect((await call('GET', `/integrity/checks/latest?${scope}`, student)).body.code).toBe('INTEGRITY_STAFF_ONLY');
    expect((await call('GET', `/integrity/matches/${matchId}`, student)).body.code).toBe('INTEGRITY_STAFF_ONLY');
    const outsider = await make.teacher();
    await make.member(organization, outsider, OrganizationMemberRoleEnum.TEACHER);
    expect((await call('GET', `/integrity/checks/latest?${scope}`, token(outsider, OrganizationMemberRoleEnum.TEACHER))).body.code).toBe('INTEGRITY_SCOPE_NOT_FOUND');

    // Thresholds: owners change them; the levels follow.
    expect((await call('PUT', '/integrity/settings', ownerToken, { high: 20, medium: 30, min_words: 50 })).body.code).toBe('INTEGRITY_THRESHOLDS_INVALID');
    expect((await call('PUT', '/integrity/settings', token(outsider, OrganizationMemberRoleEnum.TEACHER), { high: 60, medium: 30, min_words: 50 })).body.code).toBe('INTEGRITY_MANAGERS_ONLY');
    expect((await call('PUT', '/integrity/settings', ownerToken, { high: 101, medium: 30, min_words: 10 })).status).toBe(400);
    expect((await call('PUT', '/integrity/settings', ownerToken, { high: 100, medium: 30, min_words: 3 })).status).toBe(200);
    const after = (await call<Report>('GET', `/integrity/checks/latest?${scope}`, ownerToken)).body.payload;
    expect(after.submissions.find((s) => s.student.full_name === 'Chan')?.not_checked).toBeNull();
    expect(after.submissions.find((s) => s.student.full_name === 'Ana')?.level).toBe('HIGH'); // 100 ≥ 100
  });

  it('compares IELTS Writing scripts task by task', async () => {
    const owner = await make.teacher({ personal_teacher_enabled: false });
    const organization = await make.organization(owner);
    await t.dataSource.getRepository(OrganizationEntity).update({ id: organization.id }, { kind: OrganizationKindEnum.IELTS_CENTRE, workspace_type: WorkspaceTypeEnum.IELTS } as DeepPartial<OrganizationEntity>);
    await enable(organization.id, 'ielts');
    await enable(organization.id, 'integrity');
    const token = (user: UserEntity, role: OrganizationMemberRoleEnum) =>
      t.tokenFor(user, { session_mode: 'organization', context_type: 'organization', organization_id: organization.id, member_role: role });
    const ownerToken = token(owner, OrganizationMemberRoleEnum.OWNER);
    const [mitu, rafi] = [await make.student({ full_name: 'Mitu' }), await make.student({ full_name: 'Rafi' })];
    const classId = (await call<{ id: string }>('POST', '/classes', ownerToken, { class_name: 'Band 7 Course' })).body.payload.id;
    await call('POST', `/classes/${classId}/students`, ownerToken, { students: [mitu.email, rafi.email] });
    const sectionId = (await call<{ id: string }[]>('GET', `/classes/${classId}/sections`, ownerToken)).body.payload[0].id;
    const test = (await call<{ id: string; parts: { id: string }[] }>('POST', '/ielts/tests', ownerToken, { title: 'Task 2', test_type: 'GENERAL', purpose: 'PRACTICE', module: 'WRITING', part_nos: [2] })).body.payload;
    await call('PUT', `/ielts/tests/${test.id}/parts/${test.parts[0].id}`, ownerToken, { content: '<p>Discuss.</p>' });
    await call('POST', `/ielts/tests/${test.id}/publish`, ownerToken);
    const opening = (await call<{ id: string }>('POST', `/ielts/tests/${test.id}/assignments`, ownerToken, { section_id: sectionId, opens_at: new Date(Date.now() - 3_600_000).toISOString(), closes_at: new Date(Date.now() + 3_600_000).toISOString() })).body.payload;
    for (const student of [mitu, rafi]) {
      const tk = token(student, OrganizationMemberRoleEnum.STUDENT);
      const started = (await call<{ attempt: { id: string } }>('POST', `/ielts/my/assignments/${opening.id}/modules/WRITING/start`, tk)).body.payload;
      await call('POST', `/ielts/my/attempts/${started.attempt.id}/submit`, tk, { answers: [{ part_id: test.parts[0].id, answer: essay('internet') }] });
    }
    // Still open: nothing ran by itself; running it on demand works.
    expect((await call<Report>('GET', `/integrity/checks/latest?scope_type=IELTS_WRITING&scope_id=${opening.id}`, ownerToken)).body.payload.check).toBeNull();
    const report = (await call<Report>('POST', '/integrity/checks', ownerToken, { scope_type: 'IELTS_WRITING', scope_id: opening.id })).body.payload;
    expect(report.matches.map((m) => [m.score, m.level, m.part_no])).toEqual([[100, 'HIGH', 2]]);
  });
});
