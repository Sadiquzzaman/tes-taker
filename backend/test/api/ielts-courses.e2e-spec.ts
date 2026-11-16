import { RolesEnum } from '../../src/common/enums/roles.enum';
import { OrganizationEntity } from '../../src/organizations/entities/organization.entity';
import { OrganizationKindEnum } from '../../src/organizations/enums/organization-kind.enum';
import { OrganizationMemberRoleEnum } from '../../src/organizations/enums/organization-member-role.enum';
import { WorkspaceTypeEnum } from '../../src/organizations/enums/workspace-type.enum';
import { UserEntity } from '../../src/user/entities/user.entity';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

type Body<T> = { payload: T; code?: string; message?: unknown };
type Course = {
  id: string;
  title: string;
  branch: { id: string; name: string | null; is_default: boolean } | null;
  start_date: string;
  end_date: string;
  status: string;
  modules: string[];
  seat_limit: number | null;
  students: number;
  teachers: { module: string; teachers: { id: string }[] }[];
  section_id: string;
  session_id: string;
};

/** IELTS courses (P12-04, IEL-13): made on the academic engine, seat limit, who sees what, branches. */
describe('IELTS courses (P12-04)', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;
  let platformAdmin: UserEntity;

  beforeAll(async () => {
    t = await createTestApp();
    make = factories(t.dataSource);
    platformAdmin = await make.user(RolesEnum.ADMIN);
  });

  afterAll(async () => {
    await t.close();
  });

  const session = (user: UserEntity, organization: OrganizationEntity, role: OrganizationMemberRoleEnum) =>
    t.tokenFor(user, { session_mode: 'organization', context_type: 'organization', organization_id: organization.id, member_role: role });
  const feature = async (organization: OrganizationEntity, key: string) => {
    const res = await t.api.request('PUT', `/subscriptions/admin/organizations/${organization.id}/overrides/${key}`, {
      body: { value: true, reason: 'P12-04 test' },
      token: t.tokenFor(platformAdmin),
    });
    expect(res.status).toBe(200);
  };
  const centre = async () => {
    const owner = await make.teacher({ personal_teacher_enabled: false });
    const organization = await make.organization(owner, { kind: OrganizationKindEnum.IELTS_CENTRE, workspace_type: WorkspaceTypeEnum.IELTS });
    await feature(organization, 'ielts');
    return { owner, organization, ownerToken: session(owner, organization, OrganizationMemberRoleEnum.OWNER) };
  };
  const member = async (organization: OrganizationEntity, role: OrganizationMemberRoleEnum) => {
    const user = role === OrganizationMemberRoleEnum.STUDENT ? await make.student() : await make.teacher({ personal_teacher_enabled: false });
    const membership = await make.member(organization, user, role);
    return { user, membership, token: session(user, organization, role) };
  };
  const create = (token: string, body: Record<string, unknown>) => t.api.request<Body<Course>>('POST', '/ielts/courses', { body, token });

  it('makes a course with its own dates, modules, teachers and seat limit, and fills it up to the limit', async () => {
    const { organization, ownerToken } = await centre();
    const writingTeacher = await member(organization, OrganizationMemberRoleEnum.TEACHER);
    const created = await create(ownerToken, {
      title: 'Writing crash course',
      start_date: '2027-01-05',
      end_date: '2027-02-28',
      modules: ['SPEAKING', 'WRITING'],
      seat_limit: 1,
      teachers: { WRITING: [writingTeacher.user.id] },
    });
    expect(created.status).toBe(201);
    const course = created.body.payload;
    expect(course).toMatchObject({ title: 'Writing crash course', modules: ['WRITING', 'SPEAKING'], seat_limit: 1, students: 0, status: 'UPCOMING' });
    expect(course.branch?.is_default).toBe(true);
    expect(course.teachers.find((m) => m.module === 'WRITING')?.teachers.map((x) => x.id)).toEqual([writingTeacher.user.id]);
    const [ses] = await t.dataSource.query(`SELECT name, start_date::text, end_date::text, is_default FROM academic_sessions WHERE id = $1`, [course.session_id]);
    expect(ses).toMatchObject({ start_date: '2027-01-05', end_date: '2027-02-28', is_default: false });

    // The teacher sees the course they teach; the seat limit stops the second student.
    const taught = await t.api.get<Body<Course[]>>('/ielts/courses', writingTeacher.token);
    expect(taught.body.payload.map((c) => c.id)).toEqual([course.id]);
    const first = await make.student();
    const second = await make.student();
    expect((await t.api.request('POST', `/sections/${course.section_id}/enrolments`, { body: { student_id: first.id }, token: ownerToken })).status).toBeLessThan(300);
    const full = await t.api.request<Body<null>>('POST', `/sections/${course.section_id}/enrolments`, { body: { student_id: second.id }, token: ownerToken });
    expect(full.status).toBe(409);
    expect(full.body.code).toBe('SECTION_FULL');

    // Removing a course with students is refused; changing the seat limit lets the next one in.
    expect((await t.api.request<Body<null>>('DELETE', `/ielts/courses/${course.id}`, { token: ownerToken })).body.code).toBe('COURSE_HAS_STUDENTS');
    const more = await t.api.request<Body<Course>>('PATCH', `/ielts/courses/${course.id}`, { body: { seat_limit: 2, end_date: '2027-03-15' }, token: ownerToken });
    expect(more.body.payload).toMatchObject({ seat_limit: 2, end_date: '2027-03-15', students: 1 });
    expect((await t.api.request('POST', `/sections/${course.section_id}/enrolments`, { body: { student_id: second.id }, token: ownerToken })).status).toBeLessThan(300);
  });

  it('shows students their own courses only, and an ended one only for the chosen days', async () => {
    const { owner, organization, ownerToken } = await centre();
    const running = (await create(ownerToken, { title: 'Running', start_date: '2026-01-01', end_date: '2099-12-31', modules: ['READING'] })).body.payload;
    // Ended 30 days ago (dates relative to today, so the test does not age).
    const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
    const ended = (await create(ownerToken, { title: 'Ended', start_date: daysAgo(90), end_date: daysAgo(30), modules: ['LISTENING'] })).body.payload;
    const other = (await create(ownerToken, { title: 'Not mine', start_date: '2026-01-01', end_date: '2099-12-31', modules: ['WRITING'] })).body.payload;
    const student = await member(organization, OrganizationMemberRoleEnum.STUDENT);
    for (const course of [running, ended]) {
      // The ended course's session is past its dates but still open, so enrolment works for the test.
      const res = await t.api.request('POST', `/sections/${course.section_id}/enrolments`, { body: { student_id: student.user.id }, token: ownerToken });
      expect({ status: res.status, body: res.status < 300 ? null : res.body }).toEqual({ status: 201, body: null });
    }
    const mine = await t.api.get<Body<Course[]>>('/ielts/courses', student.token);
    expect(mine.body.payload.map((c) => c.title)).toEqual(['Running']);
    expect(mine.body.payload.map((c) => c.id)).not.toContain(other.id);

    const patched = await t.api.request<Body<{ ended_course_visible_days: number }>>('PATCH', `/organizations/${organization.id}/settings`, { body: { ended_course_visible_days: 365 }, token: t.tokenFor(owner) });
    expect({ status: patched.status, days: patched.body.payload?.ended_course_visible_days ?? patched.body }).toEqual({ status: 200, days: 365 });
    const withEnded = await t.api.get<Body<Course[]>>('/ielts/courses', student.token);
    expect(withEnded.body.payload.map((c) => c.title).sort()).toEqual(['Ended', 'Running']);
    expect(withEnded.body.payload.find((c) => c.title === 'Ended')?.status).toBe('ENDED');
    expect((await t.api.request('POST', '/ielts/courses', { body: { title: 'x', start_date: '2027-01-01', end_date: '2027-02-01', modules: ['READING'] }, token: student.token })).status).toBe(403);
  });

  it('keeps a branch manager to their branch', async () => {
    const { owner, organization, ownerToken } = await centre();
    await feature(organization, 'attendance');
    const branch = (await t.api.request<Body<{ id: string }>>('POST', '/attendance/branches', { body: { name: 'Farmgate', geo_lat: 23.75, geo_lng: 90.39, checkin_radius_m: 150 }, token: ownerToken })).body.payload;
    const manager = await member(organization, OrganizationMemberRoleEnum.TEACHER);
    await t.api.request('PATCH', `/organizations/${organization.id}/members/${manager.membership.id}`, { body: { role: 'BRANCH_MANAGER', branch_id: branch.id }, token: t.tokenFor(owner) });
    const managerToken = session(manager.user, organization, OrganizationMemberRoleEnum.BRANCH_MANAGER);

    const main = (await create(ownerToken, { title: 'Main branch course', start_date: '2027-01-01', end_date: '2027-02-01', modules: ['READING'] })).body.payload;
    const farmgateRes = await create(managerToken, { title: 'Farmgate course', start_date: '2027-01-01', end_date: '2027-02-01', modules: ['WRITING'] });
    expect({ status: farmgateRes.status, body: farmgateRes.status < 300 ? null : farmgateRes.body }).toEqual({ status: 201, body: null });
    const farmgate = farmgateRes.body.payload;
    expect(farmgate.branch?.id).toBe(branch.id);
    const listed = await t.api.get<Body<Course[]>>('/ielts/courses', managerToken);
    expect(listed.body.payload.map((c) => c.id)).toEqual([farmgate.id]);
    expect((await t.api.get(`/ielts/courses/${main.id}`, managerToken)).status).toBe(404);
    expect((await t.api.request('PATCH', `/ielts/courses/${main.id}`, { body: { title: 'Mine now' }, token: managerToken })).status).toBe(404);
    // The owner sees both.
    expect((await t.api.get<Body<Course[]>>('/ielts/courses', ownerToken)).body.payload).toHaveLength(2);
  });

  it('refuses bad input and academic schools', async () => {
    const { ownerToken } = await centre();
    expect((await create(ownerToken, { title: 'Bad dates', start_date: '2027-02-01', end_date: '2027-01-01', modules: ['READING'] })).body.code).toBe('IELTS_COURSE_INVALID');
    expect((await create(ownerToken, { title: 'No modules', start_date: '2027-01-01', end_date: '2027-02-01', modules: [] })).body.code).toBe('IELTS_COURSE_INVALID');
    const schoolOwner = await make.teacher({ personal_teacher_enabled: false });
    const school = await make.organization(schoolOwner);
    await feature(school, 'ielts');
    const refused = await create(session(schoolOwner, school, OrganizationMemberRoleEnum.OWNER), { title: 'x', start_date: '2027-01-01', end_date: '2027-02-01', modules: ['READING'] });
    expect(refused.body.code).toBe('IELTS_ONLY_CENTRES');
  });
});
