import { AuditService } from '../../src/audit/audit.service';
import { AuditLogEntity } from '../../src/audit/entities/audit-log.entity';
import { AcademicSessionEntity, AcademicSessionStatusEnum } from '../../src/academics/entities/academic-session.entity';
import { SectionEntity } from '../../src/academics/entities/section.entity';
import { ActiveStatusEnum } from '../../src/common/enums/active-status.enum';
import { RolesEnum } from '../../src/common/enums/roles.enum';
import { BranchEntity } from '../../src/organizations/entities/branch.entity';
import { OrganizationEntity } from '../../src/organizations/entities/organization.entity';
import { OrganizationMemberRoleEnum } from '../../src/organizations/enums/organization-member-role.enum';
import { UserEntity } from '../../src/user/entities/user.entity';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

type Branch = {
  id: string;
  name: string | null;
  address: string | null;
  geo_lat: number | null;
  geo_lng: number | null;
  checkin_radius_m: number;
  is_default: boolean;
  section_count: number;
};
type Body<T> = { payload: T; code?: string; feature?: string; message?: string; details?: Record<string, unknown> };

const FARMGATE = { name: 'Farmgate', address: 'Green Road', geo_lat: 23.7577, geo_lng: 90.3897, checkin_radius_m: 150 };

/**
 * Branches and the check-in radius (P3-02, ATT-15): the hidden main branch, who reads and changes
 * branches, the rules, soft removal, solo workspaces, the plan gate, tenancy and audit.
 */
describe('attendance branches API', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;
  let audit: AuditService;
  let admin: UserEntity;

  const orgSession = (user: UserEntity, organization: OrganizationEntity, role = OrganizationMemberRoleEnum.OWNER) =>
    t.tokenFor(user, { session_mode: 'organization', context_type: 'organization', organization_id: organization.id, member_role: role });

  const list = (token: string) => t.api.get<Body<Branch[]>>('/attendance/branches', token);
  const create = (token: string, body: unknown) => t.api.request<Body<Branch>>('POST', '/attendance/branches', { body, token });
  const update = (token: string, id: string, body: unknown) =>
    t.api.request<Body<Branch>>('PATCH', `/attendance/branches/${id}`, { body, token });
  const remove = (token: string, id: string) => t.api.request<Body<null>>('DELETE', `/attendance/branches/${id}`, { token });

  const enableAttendance = async (organization: OrganizationEntity) => {
    const response = await t.api.request('PUT', `/subscriptions/admin/organizations/${organization.id}/overrides/attendance`, {
      body: { value: true, reason: 'P3-02 test' },
      token: t.tokenFor(admin),
    });
    expect(response.status).toBe(200);
  };

  const school = async ({ enabled = true } = {}) => {
    const owner = await make.teacher({ personal_teacher_enabled: false });
    const organization = await make.organization(owner);
    if (enabled) await enableAttendance(organization);
    return { owner, organization, token: orgSession(owner, organization) };
  };

  const memberOf = async (organization: OrganizationEntity, role: OrganizationMemberRoleEnum) => {
    const user = role === OrganizationMemberRoleEnum.STUDENT ? await make.student() : await make.teacher({ personal_teacher_enabled: false });
    await make.member(organization, user, role);
    return orgSession(user, organization, role);
  };

  /** A class made on the class screens: it gets section "A" in the default session. */
  const sectionOf = async (token: string, name: string) => {
    const created = await t.api.request<Body<{ id: string }>>('POST', '/classes', { body: { class_name: name }, token });
    expect(created.status).toBe(201);
    return t.dataSource.getRepository(SectionEntity).findOneByOrFail({ class_id: created.body.payload.id });
  };

  const mainOf = async (token: string) => (await list(token)).body.payload.find((branch) => branch.is_default) as Branch;

  beforeAll(async () => {
    t = await createTestApp();
    make = factories(t.dataSource);
    audit = t.app.get(AuditService);
    admin = await make.user(RolesEnum.SUPER_ADMIN);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterAll(async () => {
    await t.close();
  });

  it('gives an organisation without branches one hidden main branch that holds its pin and radius', async () => {
    const { organization, token } = await school();
    await sectionOf(token, 'Class 6');
    // Two first requests at once still create a single main branch.
    const [first, second] = await Promise.all([list(token), list(token)]);
    expect(first.status).toBe(200);
    expect(second.body.payload).toEqual(first.body.payload);
    expect(first.body.payload).toEqual([
      { id: expect.any(String), name: null, address: null, geo_lat: null, geo_lng: null, checkin_radius_m: 100, is_default: true, section_count: 1 },
    ]);
    expect(await t.dataSource.getRepository(BranchEntity).countBy({ organization_id: organization.id })).toBe(1);

    const main = first.body.payload[0];
    const pinned = await update(token, main.id, { geo_lat: 23.810331, geo_lng: 90.412521, checkin_radius_m: 250 });
    expect(pinned.status).toBe(200);
    expect(pinned.body.payload).toMatchObject({ geo_lat: 23.810331, geo_lng: 90.412521, checkin_radius_m: 250, is_default: true });
    expect(await mainOf(token)).toMatchObject({ geo_lat: 23.810331, geo_lng: 90.412521, checkin_radius_m: 250 });
  });

  it('adds branches with a pin and radius; a new branch takes the main radius when none is given', async () => {
    const { token } = await school();
    const main = await mainOf(token);
    await update(token, main.id, { checkin_radius_m: 300 });

    const farmgate = await create(token, FARMGATE);
    expect(farmgate.status).toBe(201);
    expect(farmgate.body.payload).toEqual({ id: expect.any(String), ...FARMGATE, is_default: false, section_count: 0 });
    const badda = await create(token, { name: '  Badda ' });
    expect(badda.body.payload).toMatchObject({ name: 'Badda', geo_lat: null, checkin_radius_m: 300 });

    // The main branch first, then by name.
    expect((await list(token)).body.payload.map((branch) => branch.name)).toEqual([null, 'Badda', 'Farmgate']);

    // The main branch can be named, and its name cleared again; other branches need a name.
    expect((await update(token, main.id, { name: 'Motijheel' })).body.payload.name).toBe('Motijheel');
    expect((await update(token, main.id, { name: '' })).body.payload.name).toBeNull();
    const unnamed = await update(token, farmgate.body.payload.id, { name: ' ' });
    expect(unnamed.status).toBe(400);
    expect(unnamed.body.code).toBe('ATTENDANCE_BRANCH_NAME_REQUIRED');

    // Clearing the pin needs both coordinates.
    const cleared = await update(token, farmgate.body.payload.id, { geo_lat: null, geo_lng: null });
    expect(cleared.body.payload).toMatchObject({ geo_lat: null, geo_lng: null, checkin_radius_m: 150 });
  });

  it('rejects invalid branches', async () => {
    const { token } = await school();
    await create(token, FARMGATE);
    const bad: unknown[] = [
      {},
      { name: '' },
      { name: 'x'.repeat(121) },
      { name: 'Badda', geo_lat: 91, geo_lng: 90 },
      { name: 'Badda', geo_lat: 23, geo_lng: 181 },
      { name: 'Badda', checkin_radius_m: 24 },
      { name: 'Badda', checkin_radius_m: 1001 },
      { name: 'Badda', checkin_radius_m: 100.5 },
    ];
    for (const body of bad) expect([body, (await create(token, body)).status]).toEqual([body, 400]);

    const half = await create(token, { name: 'Badda', geo_lat: 23.78 });
    expect(half.status).toBe(400);
    expect(half.body.code).toBe('ATTENDANCE_BRANCH_PIN_INCOMPLETE');
    const taken = await create(token, { name: 'farmgate' });
    expect(taken.status).toBe(409);
    expect(taken.body.code).toBe('ATTENDANCE_BRANCH_NAME_TAKEN');
    expect((await list(token)).body.payload).toHaveLength(2);
  });

  it('removes a branch by keeping its row, never the main branch or one an open section uses', async () => {
    const { owner, organization, token } = await school();
    const main = await mainOf(token);
    const kept = await remove(token, main.id);
    expect(kept.status).toBe(400);
    expect(kept.body.code).toBe('ATTENDANCE_BRANCH_DEFAULT_KEPT');

    const farmgate = (await create(token, FARMGATE)).body.payload;
    const section = await sectionOf(token, 'Class 7');
    await t.dataSource.getRepository(SectionEntity).update(section.id, { branch_id: farmgate.id });
    expect((await list(token)).body.payload.find((branch) => branch.id === farmgate.id)?.section_count).toBe(1);
    expect((await mainOf(token)).section_count).toBe(0);
    const inUse = await remove(token, farmgate.id);
    expect(inUse.status).toBe(409);
    expect(inUse.body).toMatchObject({ code: 'ATTENDANCE_BRANCH_IN_USE', details: { sections: 1 } });

    // Once the session is closed, its sections no longer hold the branch; they keep pointing at it.
    await t.dataSource
      .getRepository(AcademicSessionEntity)
      .update({ organization_id: organization.id }, { status: AcademicSessionStatusEnum.CLOSED });
    const removed = await remove(token, farmgate.id);
    expect(removed.status).toBe(200);
    expect((await list(token)).body.payload.map((branch) => branch.id)).toEqual([main.id]);
    const row = await t.dataSource.getRepository(BranchEntity).findOneByOrFail({ id: farmgate.id });
    expect(row).toMatchObject({ is_active: ActiveStatusEnum.INACTIVE, removed_by: owner.id, name: 'Farmgate' });
    expect(row.removed_at).toBeInstanceOf(Date);
    expect((await t.dataSource.getRepository(SectionEntity).findOneByOrFail({ id: section.id })).branch_id).toBe(farmgate.id);

    // A removed branch can no longer be changed or removed again; its name is free again.
    expect((await update(token, farmgate.id, { name: 'Farmgate 2' })).status).toBe(404);
    expect((await remove(token, farmgate.id)).status).toBe(404);
    expect((await create(token, FARMGATE)).status).toBe(201);
  });

  it('gives a solo teacher one location: a pin on the main branch, optional for online-only teaching', async () => {
    const teacher = await make.teacher();
    const solo = await make.soloOrganization(teacher);
    await enableAttendance(solo);
    const token = t.tokenFor(teacher);
    const branches = (await list(token)).body.payload;
    expect(branches).toHaveLength(1);
    expect(branches[0]).toMatchObject({ is_default: true, geo_lat: null });

    const more = await create(token, FARMGATE);
    expect(more.status).toBe(400);
    expect(more.body.code).toBe('ATTENDANCE_BRANCHES_NOT_FOR_SOLO');
    expect((await update(token, branches[0].id, { geo_lat: 23.75, geo_lng: 90.38 })).status).toBe(200);
  });

  it('lets the owner and admins change branches; teachers and assistants read them; students neither', async () => {
    const { organization, token } = await school();
    const adminToken = await memberOf(organization, OrganizationMemberRoleEnum.ADMIN);
    const teacherToken = await memberOf(organization, OrganizationMemberRoleEnum.TEACHER);
    const assistantToken = await memberOf(organization, OrganizationMemberRoleEnum.ASSISTANT);
    const studentToken = await memberOf(organization, OrganizationMemberRoleEnum.STUDENT);

    const created = await create(adminToken, FARMGATE);
    expect(created.status).toBe(201);
    const id = created.body.payload.id;
    expect((await update(adminToken, id, { checkin_radius_m: 200 })).status).toBe(200);
    for (const reader of [teacherToken, assistantToken]) {
      expect((await list(reader)).body.payload).toHaveLength(2);
      expect((await create(reader, { name: 'Badda' })).status).toBe(403);
      expect((await update(reader, id, { checkin_radius_m: 300 })).status).toBe(403);
      expect((await remove(reader, id)).status).toBe(403);
    }
    expect((await list(studentToken)).status).toBe(403);
    expect((await remove(adminToken, id)).status).toBe(200);
    expect((await list(token)).body.payload).toHaveLength(1);
  });

  it('refuses branches with FEATURE_NOT_IN_PLAN while the plan has no attendance', async () => {
    const { token } = await school({ enabled: false });
    for (const response of [await list(token), await create(token, FARMGATE)]) {
      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({ code: 'FEATURE_NOT_IN_PLAN', feature: 'attendance' });
    }
  });

  it("never reads or changes another organisation's branches", async () => {
    const a = await school();
    const b = await school();
    const farmgate = (await create(a.token, FARMGATE)).body.payload;
    const mainA = await mainOf(a.token);

    expect((await list(b.token)).body.payload.map((branch) => branch.id)).not.toContain(farmgate.id);
    for (const id of [farmgate.id, mainA.id]) {
      expect((await update(b.token, id, { name: 'Taken over', checkin_radius_m: 999 })).status).toBe(404);
      expect((await remove(b.token, id)).status).toBe(404);
    }
    // A's owner pointing at B's workspace is not a member there.
    const crossToken = orgSession(a.owner, b.organization);
    expect((await list(crossToken)).status).toBe(403);
    expect((await create(crossToken, { name: 'Badda' })).status).toBe(403);
    expect((await list(a.token)).body.payload.find((branch) => branch.id === farmgate.id)).toMatchObject(FARMGATE);
  });

  it('records adding, changing and removing a branch in the audit log', async () => {
    const { owner, organization, token } = await school();
    const farmgate = (await create(token, FARMGATE)).body.payload;
    await update(token, farmgate.id, { checkin_radius_m: 200 });
    await update(token, farmgate.id, { checkin_radius_m: 200 }); // no change, no row
    await remove(token, farmgate.id);
    await audit.flush();
    const rows = await t.dataSource
      .getRepository(AuditLogEntity)
      .find({ where: { organization_id: organization.id, entity_type: 'branch' }, order: { created_at: 'ASC' } });
    expect(rows.map((row) => row.action)).toEqual(['branch.create', 'branch.update', 'branch.remove']);
    expect(rows.every((row) => row.actor_id === owner.id && row.entity_id === farmgate.id)).toBe(true);
    expect(rows[0].after).toEqual({ name: 'Farmgate', address: 'Green Road', geo_lat: 23.7577, geo_lng: 90.3897, checkin_radius_m: 150 });
    expect(rows[1]).toMatchObject({ before: { checkin_radius_m: 150 }, after: { checkin_radius_m: 200 } });
    expect(rows[2].before).toMatchObject({ name: 'Farmgate', checkin_radius_m: 200 });
  });
});
