import { OrganizationEntity } from '../../src/organizations/entities/organization.entity';
import { OrganizationMemberRoleEnum } from '../../src/organizations/enums/organization-member-role.enum';
import { UserEntity } from '../../src/user/entities/user.entity';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

const { OWNER, ADMIN, ASSISTANT, TEACHER, STUDENT } = OrganizationMemberRoleEnum;

/**
 * Who may read a school's people (co-founder review, 13 Nov): owners, admins and staff see the
 * Teachers, Staff and Students lists; only owners and admins add or remove people.
 */
describe('members directory API', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;

  const session = (user: UserEntity, organization: OrganizationEntity, role: OrganizationMemberRoleEnum) =>
    t.tokenFor(user, { session_mode: 'organization', context_type: 'organization', organization_id: organization.id, member_role: role });

  beforeAll(async () => {
    t = await createTestApp();
    make = factories(t.dataSource);
  });

  afterAll(async () => {
    await t.close();
  });

  it('lets owners, admins and staff read the members, and only owners and admins add them', async () => {
    const owner = await make.teacher({ personal_teacher_enabled: false });
    const school = await make.organization(owner);
    const people: Record<string, UserEntity> = { OWNER: owner };
    for (const role of [ADMIN, ASSISTANT, TEACHER]) {
      people[role] = await make.teacher({ personal_teacher_enabled: false });
      await make.member(school, people[role], role);
    }
    people.STUDENT = await make.student();
    await make.member(school, people.STUDENT, STUDENT);

    const list = (role: OrganizationMemberRoleEnum) => t.api.request<{ payload: { role: string }[] }>('GET', `/organizations/${school.id}/members`, { token: session(people[role], school, role) });
    for (const role of [OWNER, ADMIN, ASSISTANT]) {
      const res = await list(role);
      expect([role, res.status]).toEqual([role, 200]);
      expect(res.body.payload.map((m) => m.role).sort()).toEqual([ADMIN, ASSISTANT, OWNER, STUDENT, TEACHER].sort());
    }
    for (const role of [TEACHER, STUDENT]) expect([role, (await list(role)).status]).toEqual([role, 403]);

    // Staff read the list but do not add people.
    const newcomer = await make.student();
    const added = await t.api.request('POST', `/organizations/${school.id}/members`, {
      token: session(people.ASSISTANT, school, ASSISTANT),
      body: { query: newcomer.email, role: STUDENT },
    });
    expect(added.status).toBe(403);

    // Staff of another school see nothing here.
    const otherOwner = await make.teacher({ personal_teacher_enabled: false });
    const other = await make.organization(otherOwner);
    const otherStaff = await make.teacher({ personal_teacher_enabled: false });
    await make.member(other, otherStaff, ASSISTANT);
    const res = await t.api.request('GET', `/organizations/${school.id}/members`, { token: session(otherStaff, other, ASSISTANT) });
    expect(res.status).toBe(403);
  });
});
