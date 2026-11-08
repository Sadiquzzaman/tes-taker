import { DeepPartial } from 'typeorm';
import { RolesEnum } from '../../src/common/enums/roles.enum';
import { SubjectEntity } from '../../src/subjects/entities/subject.entity';
import { OrgSettingsEntity } from '../../src/organizations/entities/org-settings.entity';
import { OrganizationEntity } from '../../src/organizations/entities/organization.entity';
import { OrganizationMemberRoleEnum } from '../../src/organizations/enums/organization-member-role.enum';
import { OrgSetupCompleted1755510000000 } from '../../src/migrations/1755510000000-OrgSetupCompleted';
import { UserEntity } from '../../src/user/entities/user.entity';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

type Payload<T> = { payload: T };
type Summary = {
  setup_completed_at: string | null;
  session: { id: string; name: string };
  classes: Array<{ id: string; name: string; subject_count: number; section_count: number; student_count: number; subjects_without_teacher: string[] }>;
  checkin_pin_missing: boolean;
};

/** The academic setup wizard (P2-04, FND-02): progress, finishing it, and the migration for existing schools. */
describe('academic setup API', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;

  const orgToken = (user: UserEntity, organization: OrganizationEntity, role: OrganizationMemberRoleEnum) =>
    t.tokenFor(user, { session_mode: 'organization', context_type: 'organization', organization_id: organization.id, member_role: role });
  const call = <T>(method: string, path: string, token: string, body?: unknown) => t.api.request<T>(method, path, { token, body });

  /** A new school with an owner, an admin, an assistant and a teacher. */
  const newSchool = async () => {
    const [owner, admin, assistant, teacher] = [
      await make.teacher({ personal_teacher_enabled: false }),
      await make.teacher({ personal_teacher_enabled: false }),
      await make.teacher({ personal_teacher_enabled: false }),
      await make.teacher({ personal_teacher_enabled: false }),
    ];
    const school = await make.organization(owner);
    await make.member(school, admin, OrganizationMemberRoleEnum.ADMIN);
    await make.member(school, assistant, OrganizationMemberRoleEnum.ASSISTANT);
    await make.member(school, teacher, OrganizationMemberRoleEnum.TEACHER);
    return {
      school,
      asOwner: () => orgToken(owner, school, OrganizationMemberRoleEnum.OWNER),
      asAdmin: () => orgToken(admin, school, OrganizationMemberRoleEnum.ADMIN),
      asAssistant: () => orgToken(assistant, school, OrganizationMemberRoleEnum.ASSISTANT),
      asTeacher: () => orgToken(teacher, school, OrganizationMemberRoleEnum.TEACHER),
    };
  };

  beforeAll(async () => {
    t = await createTestApp();
    make = factories(t.dataSource);
  });

  afterAll(async () => {
    await t.close();
  });

  it('shows a new school as not set up, with its default session and no classes', async () => {
    const { asOwner } = await newSchool();
    const summary = await call<Payload<Summary>>('GET', '/setup', asOwner());
    expect(summary.status).toBe(200);
    expect(summary.body.payload).toMatchObject({ setup_completed_at: null, classes: [] });
    expect(summary.body.payload.session.name).toMatch(/^\d{4}$/);
  });

  it('counts subjects and sections per class, and finishes once every class has a section', async () => {
    const { school, asOwner, asAdmin } = await newSchool();
    expect((await call('POST', '/setup/complete', asAdmin())).status).toBe(400);

    const classId = (await call<Payload<{ id: string }>>('POST', '/classes', asOwner(), { class_name: 'Class 6' })).body.payload.id;
    await call('POST', `/classes/${classId}/sections`, asAdmin(), { name: 'B' });
    const summary = (await call<Payload<Summary>>('GET', '/setup', asAdmin())).body.payload;
    // Section A comes with every new class.
    expect(summary.classes).toEqual([{ id: classId, name: 'Class 6', subject_count: 0, section_count: 2, student_count: 0, subjects_without_teacher: [] }]);

    const done = await call<Payload<Summary>>('POST', '/setup/complete', asAdmin());
    expect(done.status).toBe(200);
    const finishedAt = done.body.payload.setup_completed_at;
    expect(finishedAt).not.toBeNull();

    // Finishing again keeps the first time; the settings show it too.
    expect((await call<Payload<Summary>>('POST', '/setup/complete', asOwner())).body.payload.setup_completed_at).toBe(finishedAt);
    const settings = await call<Payload<{ setup_completed_at: string | null }>>('GET', `/organizations/${school.id}/settings`, asOwner());
    expect(settings.body.payload.setup_completed_at).toBe(finishedAt);
  });

  it('lists classes in natural order and warns about subjects without teachers, classes without students and a missing pin', async () => {
    const { school, asOwner } = await newSchool();
    const admin = await make.user(RolesEnum.SUPER_ADMIN);
    const override = (key: string, value: boolean) =>
      t.api.request('PUT', `/subscriptions/admin/organizations/${school.id}/overrides/${key}`, { body: { value, reason: 'setup warnings test' }, token: t.tokenFor(admin) });
    const class10 = (await call<Payload<{ id: string }>>('POST', '/classes', asOwner(), { class_name: 'Class 10' })).body.payload.id;
    const class6 = (await call<Payload<{ id: string }>>('POST', '/classes', asOwner(), { class_name: 'Class 6' })).body.payload.id;
    const math = await t.dataSource.getRepository(SubjectEntity).save({ name: 'Math', code: 'MTH', organization_id: school.id } as DeepPartial<SubjectEntity>);
    expect((await call('POST', `/classes/${class6}/subjects`, asOwner(), { subject_id: math.id })).status).toBe(201);
    const [section10] = (await call<Payload<{ id: string }[]>>('GET', `/classes/${class10}/sections`, asOwner())).body.payload;
    const mitu = await make.student({ full_name: 'Mitu' });
    expect((await call('POST', `/sections/${section10.id}/enrolments`, asOwner(), { student_id: mitu.id })).status).toBe(201);

    expect((await override('attendance', false)).status).toBe(200);
    let summary = (await call<Payload<Summary>>('GET', '/setup', asOwner())).body.payload;
    expect(summary.classes.map((c) => [c.name, c.student_count, c.subjects_without_teacher])).toEqual([
      ['Class 6', 0, ['Math']],
      ['Class 10', 1, []],
    ]);
    // Without attendance there is no check-in to set up.
    expect(summary.checkin_pin_missing).toBe(false);

    expect((await override('attendance', true)).status).toBe(200);
    expect((await call<Payload<Summary>>('GET', '/setup', asOwner())).body.payload.checkin_pin_missing).toBe(true);
    await t.dataSource.query(`UPDATE branches SET geo_lat = 23.75, geo_lng = 90.38 WHERE organization_id = $1 AND is_default`, [school.id]);
    summary = (await call<Payload<Summary>>('GET', '/setup', asOwner())).body.payload;
    expect(summary.checkin_pin_missing).toBe(false);
  });

  it('needs a section for every class in the default session', async () => {
    const { asOwner } = await newSchool();
    await call('POST', '/classes', asOwner(), { class_name: 'Class 9' });
    // A new default session: Class 9 has no section in it yet.
    const nextYear = new Date().getFullYear() + 1;
    await call('POST', '/sessions', asOwner(), { name: String(nextYear), start_date: `${nextYear}-01-01`, end_date: `${nextYear}-12-31`, is_default: true });
    const refused = await call<{ message: string }>('POST', '/setup/complete', asOwner());
    expect(refused.status).toBe(400);
    expect(refused.body.message).toContain('Class 9');
  });

  it('is for owners and admins of schools only', async () => {
    const { asAssistant, asTeacher } = await newSchool();
    for (const token of [asAssistant(), asTeacher()]) {
      expect((await call('GET', '/setup', token)).status).toBe(403);
      expect((await call('POST', '/setup/complete', token)).status).toBe(403);
    }
    const solo = await make.teacher();
    expect((await call('GET', '/setup', t.tokenFor(solo))).status).toBe(400);
    expect((await call('POST', '/setup/complete', t.tokenFor(solo))).status).toBe(400);
  });

  it('keeps each school to itself', async () => {
    const first = await newSchool();
    await call('POST', '/classes', first.asOwner(), { class_name: 'Class 6' });
    const second = await newSchool();
    expect((await call<Payload<Summary>>('GET', '/setup', second.asOwner())).body.payload.classes).toEqual([]);
    expect((await call('POST', '/setup/complete', second.asOwner())).status).toBe(400);
  });

  describe('migration', () => {
    beforeAll(() => {
      jest.spyOn(console, 'log').mockImplementation(() => undefined);
    });

    it('marks schools that already have classes as set up, once', async () => {
      const withClasses = await newSchool();
      await call('POST', '/classes', withClasses.asOwner(), { class_name: 'Class 6' });
      // A school whose settings row was never created (before P2-03's backfill, or never changed).
      await t.dataSource.getRepository(OrgSettingsEntity).delete({ organization_id: withClasses.school.id });
      const empty = await newSchool();

      const runner = t.dataSource.createQueryRunner();
      const migration = new OrgSetupCompleted1755510000000();
      await migration.down(runner);
      await migration.up(runner);
      const settingsOf = (school: OrganizationEntity) =>
        t.dataSource.query(`SELECT setup_completed_at FROM org_settings WHERE organization_id = $1`, [school.id]);

      const [marked] = await settingsOf(withClasses.school);
      expect(marked.setup_completed_at).not.toBeNull();
      expect(await settingsOf(empty.school)).toEqual([]);

      // A second run changes nothing.
      await migration.up(runner);
      expect(await settingsOf(withClasses.school)).toEqual([marked]);
      await runner.release();
    });
  });
});
