import { randomUUID } from 'crypto';
import { RolesEnum } from '../../src/common/enums/roles.enum';
import { buildSwaggerDocument } from '../../src/common/swagger/swagger.setup';
import { OrganizationMemberEntity } from '../../src/organizations/entities/organization-member.entity';
import { OrganizationEntity } from '../../src/organizations/entities/organization.entity';
import { OrganizationMemberRoleEnum } from '../../src/organizations/enums/organization-member-role.enum';
import { UserEntity } from '../../src/user/entities/user.entity';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

type Body<T> = { payload: T; code?: string; message?: string };
type Branch = { id: string; name: string | null; is_default: boolean };

/**
 * Branch managers and the branches switch (P12-01, FND-06). Branch managers are refused on every
 * endpoint not marked @BranchScoped(), so the sweep at the end lists exactly what they can read.
 */
describe('branch managers (P12-01)', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;
  let platformAdmin: UserEntity;

  const orgSession = (user: UserEntity, organization: OrganizationEntity, role: OrganizationMemberRoleEnum) =>
    t.tokenFor(user, { session_mode: 'organization', context_type: 'organization', organization_id: organization.id, member_role: role });

  beforeAll(async () => {
    t = await createTestApp();
    make = factories(t.dataSource);
    platformAdmin = await make.user(RolesEnum.ADMIN);
  });

  afterAll(async () => {
    await t.close();
  });

  /** A school with attendance on, a second branch and a teacher made its branch manager. */
  const schoolWithManager = async () => {
    const owner = await make.teacher({ personal_teacher_enabled: false });
    const organization = await make.organization(owner);
    const enabled = await t.api.request('PUT', `/subscriptions/admin/organizations/${organization.id}/overrides/attendance`, {
      body: { value: true, reason: 'P12-01 test' },
      token: t.tokenFor(platformAdmin),
    });
    expect(enabled.status).toBe(200);
    const ownerToken = orgSession(owner, organization, OrganizationMemberRoleEnum.OWNER);
    const branch = await t.api.request<Body<Branch>>('POST', '/attendance/branches', {
      body: { name: `Farmgate ${randomUUID().slice(0, 6)}`, geo_lat: 23.7577, geo_lng: 90.3897, checkin_radius_m: 150 },
      token: ownerToken,
    });
    expect(branch.status).toBe(201);
    const managerUser = await make.teacher({ personal_teacher_enabled: false });
    const membership = await make.member(organization, managerUser, OrganizationMemberRoleEnum.TEACHER);
    const changed = await t.api.request<Body<{ role: string; branch_id: string }>>(
      'PATCH',
      `/organizations/${organization.id}/members/${membership.id}`,
      { body: { role: 'BRANCH_MANAGER', branch_id: branch.body.payload.id }, token: t.tokenFor(owner) },
    );
    expect(changed.status).toBe(200);
    expect(changed.body.payload).toMatchObject({ role: 'BRANCH_MANAGER', branch_id: branch.body.payload.id });
    return {
      owner,
      organization,
      ownerToken,
      branch: branch.body.payload,
      membership,
      managerUser,
      managerToken: orgSession(managerUser, organization, OrganizationMemberRoleEnum.BRANCH_MANAGER),
    };
  };

  it('switches branches on when a branch is added, and off only when none is left', async () => {
    const { organization, owner, ownerToken, branch, membership } = await schoolWithManager();
    const settings = await t.api.get<Body<{ branches_enabled: boolean }>>(`/organizations/${organization.id}/settings`, t.tokenFor(owner));
    expect(settings.body.payload.branches_enabled).toBe(true);

    const off = await t.api.request<Body<null>>('PATCH', `/organizations/${organization.id}/settings`, { body: { branches_enabled: false }, token: t.tokenFor(owner) });
    expect(off.status).toBe(409);
    expect(off.body.code).toBe('BRANCHES_IN_USE');

    // A branch with a manager cannot be removed; once the manager is a teacher again, it can.
    const removeManaged = await t.api.request<Body<null>>('DELETE', `/attendance/branches/${branch.id}`, { token: ownerToken });
    expect(removeManaged.status).toBe(409);
    expect(removeManaged.body.code).toBe('ATTENDANCE_BRANCH_HAS_MANAGER');
    const back = await t.api.request<Body<{ role: string; branch_id: string | null }>>('PATCH', `/organizations/${organization.id}/members/${membership.id}`, {
      body: { role: 'TEACHER' },
      token: t.tokenFor(owner),
    });
    expect(back.body.payload).toMatchObject({ role: 'TEACHER', branch_id: null });
    expect((await t.api.request('DELETE', `/attendance/branches/${branch.id}`, { token: ownerToken })).status).toBe(200);
    const offNow = await t.api.request<Body<{ branches_enabled: boolean }>>('PATCH', `/organizations/${organization.id}/settings`, {
      body: { branches_enabled: false },
      token: t.tokenFor(owner),
    });
    expect(offNow.status).toBe(200);
    expect(offNow.body.payload.branches_enabled).toBe(false);
  });

  it('makes a branch manager only from an existing staff member, with a branch of this organisation', async () => {
    const { organization, owner } = await schoolWithManager();
    const other = await make.organization(await make.teacher());
    const otherBranch = await t.dataSource.query(`INSERT INTO branches (organization_id, name, is_default, checkin_radius_m) VALUES ($1, 'Elsewhere', false, 100) RETURNING id`, [other.id]);
    const teacher = await make.teacher({ personal_teacher_enabled: false });
    const membership = await make.member(organization, teacher, OrganizationMemberRoleEnum.TEACHER);
    const patch = (body: unknown) =>
      t.api.request<Body<null>>('PATCH', `/organizations/${organization.id}/members/${membership.id}`, { body, token: t.tokenFor(owner) });

    expect((await patch({ role: 'BRANCH_MANAGER' })).body.code).toBe('BRANCH_REQUIRED');
    expect((await patch({ role: 'BRANCH_MANAGER', branch_id: otherBranch[0].id })).body.code).toBe('BRANCH_REQUIRED');

    const student = await make.student();
    const studentMembership = await make.member(organization, student, OrganizationMemberRoleEnum.STUDENT);
    const branchId = (await t.dataSource.query(`SELECT id FROM branches WHERE organization_id = $1 AND NOT is_default`, [organization.id]))[0].id;
    const asStudent = await t.api.request<Body<null>>('PATCH', `/organizations/${organization.id}/members/${studentMembership.id}`, {
      body: { role: 'BRANCH_MANAGER', branch_id: branchId },
      token: t.tokenFor(owner),
    });
    expect(asStudent.body.code).toBe('BRANCH_MANAGER_NOT_STAFF');

    const invite = await t.api.request<Body<null>>('POST', `/organizations/${organization.id}/members`, {
      body: { phone: '01799999999', role: 'BRANCH_MANAGER' },
      token: t.tokenFor(owner),
    });
    expect(invite.status).toBe(400);
    expect(invite.body.code).toBe('BRANCH_MANAGER_BY_ROLE_CHANGE');
  });

  it('lets a branch manager read only what is opened to them, and refuses the rest', async () => {
    const { managerToken } = await schoolWithManager();
    expect((await t.api.get('/me/entitlements', managerToken)).status).toBe(200);
    expect((await t.api.get('/workspace/type', managerToken)).status).toBe(200);
    expect((await t.api.get('/workspace/level-labels', managerToken)).status).toBe(200);

    const refused = await t.api.get<Body<null>>('/attendance/branches', managerToken);
    expect(refused.status).toBe(403);
    expect(refused.body.code).toBe('NOT_FOR_BRANCH_MANAGERS');
    expect((await t.api.request('PATCH', '/workspace/level-labels', { body: { preset: 'COURSE_BATCH' }, token: managerToken })).status).toBe(403);
  });

  it('refuses a branch manager whose branch was taken away', async () => {
    const { managerToken, membership } = await schoolWithManager();
    await t.dataSource.getRepository(OrganizationMemberEntity).update({ id: membership.id }, { branch_id: null });
    const response = await t.api.get<Body<null>>('/me/entitlements', managerToken);
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('NOT_FOR_BRANCH_MANAGERS');
  });

  /**
   * Every GET endpoint, called as a branch manager (path ids are this organisation's or random).
   * Anything that answers 2xx must be in this list, checked by hand: personal endpoints (their own
   * account) or ones marked @BranchScoped(). A new endpoint that leaks fails this test.
   */
  it('sweeps every GET endpoint: a branch manager gets nothing else', async () => {
    const { organization, managerToken } = await schoolWithManager();
    const document = buildSwaggerDocument(t.app);
    const paths = Object.keys(document.paths)
      .filter((path) => path.startsWith('/api/v1/'))
      .filter((path) => (document.paths[path] as Record<string, unknown>).get);
    const open: string[] = [];
    const failed: string[] = [];
    for (const path of paths) {
      const url = path.replace('/api/v1', '').replace(/\{(\w+)\}/g, (_, name: string) => (/^(id|organizationId|organization_id)$/.test(name) ? organization.id : randomUUID()));
      try {
        const response = await t.api.get(url, managerToken);
        if (response.status >= 200 && response.status < 400) open.push(path.replace('/api/v1', ''));
      } catch {
        failed.push(path.replace('/api/v1', ''));
      }
    }
    expect({ open: open.sort(), failed }).toEqual({ open: EXPECTED_OPEN.sort(), failed: [] });
  });
});

/**
 * What a branch manager may read (P12-01), each checked by hand. Grows as P12 opens scoped endpoints.
 */
const EXPECTED_OPEN: string[] = [
  // Their own account, sign-in and devices.
  '/auth/contexts',
  '/auth/google/callback',
  '/auth/profile',
  '/auth/sessions',
  '/auth/verify-token',
  '/teacher-requests/me',
  // Their own notifications, preferences and personal calendar link.
  '/me/notification-prefs',
  '/me/notifications',
  '/me/notifications/unread-count',
  '/calendar/me/ical-link',
  // Their own teaching and learning outside the organisation (personal workspace), by user id.
  '/dashboard/teacher',
  '/student/classes',
  '/student/exams/assigned',
  '/student/exams/history',
  '/student/exams/upcoming',
  '/student/exams/{examId}/eligibility',
  '/student/exams/{examId}/validate',
  // Platform-wide search of student accounts any teacher account has (not organisation data; docs/TODO.md).
  '/classes/search-students',
  // Platform catalogues.
  '/subjects',
  '/subscriptions/feature-catalog',
  '/subscriptions/plans',
  // The organisation's name, settings and the exams they made themselves; their memberships.
  '/organizations/mine',
  '/organizations/{id}',
  '/organizations/{id}/settings',
  '/organizations/{id}/exams',
  '/organizations/{id}/teachers/{teacherId}/subjects',
  // @BranchScoped(): the plan and the workspace's type and labels.
  '/me/entitlements',
  '/workspace/level-labels',
  '/workspace/type',
];
