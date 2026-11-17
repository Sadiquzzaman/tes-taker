import { RolesEnum } from '../../src/common/enums/roles.enum';
import { OrganizationEntity } from '../../src/organizations/entities/organization.entity';
import { OrganizationKindEnum } from '../../src/organizations/enums/organization-kind.enum';
import { OrganizationMemberRoleEnum } from '../../src/organizations/enums/organization-member-role.enum';
import { WorkspaceTypeEnum } from '../../src/organizations/enums/workspace-type.enum';
import { UserEntity } from '../../src/user/entities/user.entity';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

type Body<T> = { payload: T; code?: string; limit?: string };

/** P12-06: the branch allowance and the cap on how long students see ended courses. */
describe('P12 plan limits', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;
  let admin: UserEntity;

  beforeAll(async () => {
    t = await createTestApp();
    make = factories(t.dataSource);
    admin = await make.user(RolesEnum.ADMIN);
  });

  afterAll(async () => {
    await t.close();
  });

  const override = async (organization: OrganizationEntity, kind: 'overrides', key: string, value: unknown) => {
    const res = await t.api.request('PUT', `/subscriptions/admin/organizations/${organization.id}/${kind}/${key}`, { body: { value, reason: 'P12-06 test' }, token: t.tokenFor(admin) });
    expect(res.status).toBe(200);
  };
  const session = (user: UserEntity, organization: OrganizationEntity, role = OrganizationMemberRoleEnum.OWNER) =>
    t.tokenFor(user, { session_mode: 'organization', context_type: 'organization', organization_id: organization.id, member_role: role });

  it('stops new branches at the plan allowance; unlimited when unset', async () => {
    const owner = await make.teacher({ personal_teacher_enabled: false });
    const organization = await make.organization(owner);
    await override(organization, 'overrides', 'attendance', true);
    const token = session(owner, organization);
    const add = (name: string) =>
      t.api.request<Body<null>>('POST', '/attendance/branches', { body: { name, geo_lat: 23.75, geo_lng: 90.39, checkin_radius_m: 150 }, token });
    expect((await add('Farmgate')).status).toBe(201);
    expect((await add('Motijheel')).status).toBe(201);
    await override(organization, 'overrides', 'max_branches', 2);
    const third = await add('Badda');
    expect(third.status).toBe(403);
    expect(third.body).toMatchObject({ code: 'PLAN_LIMIT_REACHED', limit: 'max_branches' });
  });

  it('caps how long students see an ended course by the plan', async () => {
    const owner = await make.teacher({ personal_teacher_enabled: false });
    const organization = await make.organization(owner, { kind: OrganizationKindEnum.IELTS_CENTRE, workspace_type: WorkspaceTypeEnum.IELTS });
    await override(organization, 'overrides', 'ielts', true);
    const ownerToken = session(owner, organization);
    const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
    const course = await t.api.request<Body<{ section_id: string }>>('POST', '/ielts/courses', {
      body: { title: 'Ended 30 days ago', start_date: daysAgo(90), end_date: daysAgo(30), modules: ['READING'] },
      token: ownerToken,
    });
    const student = await make.student();
    await make.member(organization, student, OrganizationMemberRoleEnum.STUDENT);
    await t.api.request('POST', `/sections/${course.body.payload.section_id}/enrolments`, { body: { student_id: student.id }, token: ownerToken });
    await t.api.request('PATCH', `/organizations/${organization.id}/settings`, { body: { ended_course_visible_days: 60 }, token: t.tokenFor(owner) });
    const studentToken = session(student, organization, OrganizationMemberRoleEnum.STUDENT);
    expect((await t.api.get<Body<unknown[]>>('/ielts/courses', studentToken)).body.payload).toHaveLength(1);
    await override(organization, 'overrides', 'ended_course_visible_days', 14);
    expect((await t.api.get<Body<unknown[]>>('/ielts/courses', studentToken)).body.payload).toHaveLength(0);
  });
});
