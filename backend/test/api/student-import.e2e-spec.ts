import { IsNull } from 'typeorm';
import { EnrolmentEntity } from '../../src/academics/entities/enrolment.entity';
import { GuardianEntity } from '../../src/academics/entities/guardian.entity';
import { AuditService } from '../../src/audit/audit.service';
import { AuditLogEntity } from '../../src/audit/entities/audit-log.entity';
import { RolesEnum } from '../../src/common/enums/roles.enum';
import { EnrolmentInvitedName1755610000000 } from '../../src/migrations/1755610000000-EnrolmentInvitedName';
import { NotificationOutboxEntity } from '../../src/notifications/entities/notification-outbox.entity';
import { OrganizationEntity } from '../../src/organizations/entities/organization.entity';
import { OrganizationMemberRoleEnum } from '../../src/organizations/enums/organization-member-role.enum';
import { UserEntity } from '../../src/user/entities/user.entity';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

type Payload<T> = { payload: T };
type Issue = { code: string; guardian?: number };
type Row = { row: number; name: string; plan: string | null; outcome?: string; guardians: number; errors: Issue[]; warnings: Issue[] };
type Summary = { rows: Row[]; total: number; valid: number; invalid: number; limit: { max: number; current: number; adding: number; over: boolean }; invitations_sent?: number };
type Section = { id: string; name: string };

// Synthetic numbers and addresses only (no real people).
const G1 = { guardian1_name: 'Test Father', guardian1_relation: 'Father', guardian1_phone: '01700000101' };
const G2 = { guardian2_name: 'Test Mother', guardian2_relation: 'মা', guardian2_phone: '01800000102' };

/**
 * Student CSV import (P2-05, FND-04): a preview with problems per row and nothing saved, then the
 * import of the rows that pass, with guardians; one section per class per session; the plan's
 * max_students; invitations only when asked, through the outbox; audited.
 */
describe('student CSV import API', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;
  let audit: AuditService;
  let owner: UserEntity;
  let school: OrganizationEntity;
  let admin: UserEntity;

  const orgToken = (user: UserEntity, organization: OrganizationEntity, role: OrganizationMemberRoleEnum) =>
    t.tokenFor(user, { session_mode: 'organization', context_type: 'organization', organization_id: organization.id, member_role: role });
  const asOwner = () => orgToken(owner, school, OrganizationMemberRoleEnum.OWNER);
  const call = <T>(method: string, path: string, token: string, body?: unknown) => t.api.request<T>(method, path, { token, body });
  const preview = (classId: string, body: unknown, token = asOwner()) => call<Payload<Summary>>('POST', `/classes/${classId}/students/import/preview`, token, body);
  const runImport = (classId: string, body: unknown, token = asOwner()) => call<Payload<Summary>>('POST', `/classes/${classId}/students/import`, token, body);

  /** A class with sections A and B in the default session. */
  const newClass = async (name: string) => {
    const classId = (await call<Payload<{ id: string }>>('POST', '/classes', asOwner(), { class_name: name })).body.payload.id;
    expect((await call('POST', `/classes/${classId}/sections`, asOwner(), { name: 'B' })).status).toBe(201);
    const sections = (await call<Payload<Section[]>>('GET', `/classes/${classId}/sections`, asOwner())).body.payload;
    return { classId, sections };
  };
  const enrolmentsOf = (classId: string) => t.dataSource.getRepository(EnrolmentEntity).find({ where: { class_id: classId }, order: { created_at: 'ASC' } });
  const codes = (row: Row) => row.errors.map((e) => (e.guardian ? `${e.code}:${e.guardian}` : e.code));

  beforeAll(async () => {
    t = await createTestApp();
    make = factories(t.dataSource);
    audit = t.app.get(AuditService);
    owner = await make.teacher({ personal_teacher_enabled: false });
    school = await make.organization(owner);
    admin = await make.user(RolesEnum.SUPER_ADMIN);
  });

  afterAll(async () => {
    await t.close();
  });

  it('previews every row without saving: problems per row, what would happen to the others', async () => {
    const { classId } = await newClass('Class 1');
    const known = await make.student({ email: 'known-1@test.local' });
    const unverified = await make.student({ email: 'unverified-1@test.local', is_verified: false });
    const teacher = await make.teacher({ email: 'teacher-1@test.local' });

    const res = await preview(classId, {
      rows: [
        { name: 'Known', email: known.email as string, section: 'a', roll_no: '1', ...G1, ...G2 },
        { name: 'Unverified', email: unverified.email as string, section: 'A', roll_no: '2' },
        { name: 'New Student', phone: '01900000201', section: 'B', roll_no: '1' },
        { name: '', phone: '0190', section: 'C' },
        { name: 'No contact', section: '' },
        { name: 'Twice', phone: '+880 1900-000201', section: 'B' },
        { name: 'Same roll', email: 'roll@test.local', section: 'A', roll_no: '1' },
        { name: 'Teacher', email: teacher.email as string, section: 'A' },
        { name: 'Bad guardians', email: 'g@test.local', section: 'A', guardian1_name: 'X', guardian1_relation: 'Uncle', guardian1_phone: '123', guardian2_name: 'Y' },
      ],
    });
    expect(res.status).toBe(200);
    const rows = res.body.payload.rows;
    expect(rows.map((r) => r.plan)).toEqual(['ENROL', 'PENDING', 'INVITE', null, null, null, null, null, null]);
    expect(rows[0].guardians).toBe(2);
    expect(codes(rows[3])).toEqual(['NAME_REQUIRED', 'INVALID_PHONE', 'SECTION_NOT_FOUND']);
    expect(codes(rows[4])).toEqual(['CONTACT_REQUIRED', 'SECTION_REQUIRED']);
    expect(codes(rows[5])).toEqual(['DUPLICATE_IN_FILE']);
    expect(codes(rows[6])).toEqual(['ROLL_TAKEN']);
    expect(codes(rows[7])).toEqual(['STAFF_ACCOUNT']);
    expect(codes(rows[8])).toEqual(['GUARDIAN_RELATION:1', 'GUARDIAN_PHONE:1', 'GUARDIAN_INCOMPLETE:2']);
    expect(res.body.payload).toMatchObject({ total: 9, valid: 3, invalid: 6, limit: { max: 0, adding: 3, over: false } });
    expect(await enrolmentsOf(classId)).toHaveLength(0);
  });

  it('imports the rows that pass with their guardians; invitations keep the name; nothing is sent unless asked', async () => {
    const { classId, sections } = await newClass('Class 2');
    const known = await make.student({ email: 'known-2@test.local' });
    const res = await runImport(classId, {
      rows: [
        { name: 'Known', email: known.email as string, section: 'A', roll_no: '1', ...G1 },
        { name: 'Invited Student', phone: '01900000301', section: 'B', roll_no: '7', ...G1, ...G2 },
        { name: 'Broken', phone: '12', section: 'A' },
      ],
    });
    expect(res.status).toBe(201);
    expect(res.body.payload.rows.map((r) => r.outcome)).toEqual(['ENROLLED', 'INVITED', 'SKIPPED']);
    expect(res.body.payload).toMatchObject({ valid: 2, invalid: 1, invitations_sent: 0 });

    const rows = await enrolmentsOf(classId);
    const sectionB = sections.find((s) => s.name === 'B') as Section;
    expect(rows.find((r) => r.student_id === known.id)).toMatchObject({ status: 'ACTIVE', roll_no: '1' });
    const invitation = rows.find((r) => r.invited_phone === '01900000301') as EnrolmentEntity;
    expect(invitation).toMatchObject({ status: 'INVITED', invited_name: 'Invited Student', section_id: sectionB.id, roll_no: '7' });

    const guardians = t.dataSource.getRepository(GuardianEntity);
    expect(await guardians.findBy({ student_id: known.id, deleted_at: IsNull() })).toEqual([expect.objectContaining({ phone: '01700000101', is_primary: true })]);
    const invitedGuardians = await guardians.find({ where: { enrolment_id: invitation.id }, order: { is_primary: 'DESC' } });
    expect(invitedGuardians.map((g) => [g.relation, g.is_primary])).toEqual([['FATHER', true], ['MOTHER', false]]);
    expect(await t.dataSource.getRepository(NotificationOutboxEntity).countBy({ event_type: 'class.invitation' })).toBe(0);

    // The section list shows the invited student's name.
    const listed = await call<Payload<Array<{ invited_name: string | null }>>>('GET', `/sections/${sectionB.id}/enrolments`, asOwner());
    expect(listed.body.payload.map((e) => e.invited_name)).toEqual(['Invited Student']);

    await audit.flush();
    const logs = await t.dataSource.getRepository(AuditLogEntity).findBy({ organization_id: school.id, action: 'student.import', entity_id: classId });
    expect(logs).toHaveLength(1);
    expect(logs[0].after).toMatchObject({ rows: 3, imported: 2, skipped: 1, enrolled: 1, invited: 1, guardians: 3 });

    // Importing the same file again changes nothing: one section per class per session.
    const again = await preview(classId, { rows: [{ name: 'Known', email: known.email as string, section: 'B' }, { name: 'Invited Student', phone: '01900000301', section: 'A' }] });
    expect(again.body.payload.rows.map(codes)).toEqual([['ALREADY_IN_CLASS'], ['ALREADY_INVITED']]);
  });

  it("keeps a student's existing guardians instead of the file's, with a warning", async () => {
    const { classId } = await newClass('Class 3');
    const student = await make.student({ email: 'has-guardians@test.local' });
    const first = await make.enrol({ id: classId }, student);
    await call('PUT', `/enrolments/${first.id}/guardians`, asOwner(), { guardians: [{ name: 'On record', relation: 'OTHER', phone: '01700000401' }] });
    const { classId: otherClass } = await newClass('Class 3 Science');

    const res = await runImport(otherClass, { rows: [{ name: 'Has guardians', email: student.email as string, section: 'A', ...G1 }] });
    expect(res.body.payload.rows[0]).toMatchObject({ outcome: 'ENROLLED', warnings: [{ code: 'GUARDIANS_KEPT' }] });
    const live = await t.dataSource.getRepository(GuardianEntity).findBy({ student_id: student.id, deleted_at: IsNull() });
    expect(live.map((g) => g.name)).toEqual(['On record']);
  });

  it("refuses the whole import over the plan's max_students, and counts a student in two classes once", async () => {
    const { classId } = await newClass('Class 4');
    const already = await make.student({ email: 'already@test.local' });
    await make.enrol({ id: classId }, already);
    const before = (await preview(classId, { rows: [{ name: 'X', phone: '01900000501', section: 'A' }] })).body.payload.limit.current;

    const set = await t.api.request('PUT', `/subscriptions/admin/organizations/${school.id}/overrides/max_students`, {
      body: { value: before + 1, reason: 'Test limit' },
      token: t.tokenFor(admin),
    });
    expect(set.status).toBe(200);

    const { classId: second } = await newClass('Class 4 Science');
    const rows = [
      { name: 'Already here', email: already.email as string, section: 'A' },
      { name: 'New 1', phone: '01900000502', section: 'A' },
      { name: 'New 2', phone: '01900000503', section: 'A' },
    ];
    const checked = await preview(second, { rows });
    expect(checked.body.payload.limit).toEqual({ max: before + 1, current: before, adding: 2, over: true });
    const refused = await runImport(second, { rows });
    expect(refused.status).toBe(403);
    expect(refused.body).toMatchObject({ code: 'PLAN_LIMIT_REACHED', limit: 'max_students' });
    expect(await enrolmentsOf(second)).toHaveLength(0);

    // Within the limit it goes through.
    expect((await runImport(second, { rows: rows.slice(0, 2) })).status).toBe(201);
    await t.api.request('DELETE', `/subscriptions/admin/organizations/${school.id}/overrides/max_students`, { token: t.tokenFor(admin) });
  });

  it('sends invitations only when asked: email when given, otherwise SMS in the organisation language', async () => {
    const { classId } = await newClass('Class 5');
    await call('PATCH', `/organizations/${school.id}/settings`, asOwner(), { sms_locale: 'en' });
    const res = await runImport(classId, {
      send_invitations: true,
      rows: [
        { name: 'By email', email: 'invite-me@test.local', phone: '01900000601', section: 'A' },
        { name: 'By phone', phone: '01900000602', section: 'A' },
      ],
    });
    expect(res.body.payload.invitations_sent).toBe(2);
    const outbox = await t.dataSource.getRepository(NotificationOutboxEntity).find({ where: { event_type: 'class.invitation' }, order: { channel: 'ASC' } });
    expect(outbox.map((row) => [row.channel, row.to_address, row.organization_id])).toEqual([
      ['EMAIL', 'invite-me@test.local', school.id],
      ['SMS', '01900000602', school.id],
    ]);
    expect(outbox[1].locale).toBe('en');
  });

  it('is for owners, admins and assistants of the workspace only', async () => {
    const { classId } = await newClass('Class 6');
    const teacher = await make.teacher({ personal_teacher_enabled: false });
    await make.member(school, teacher, OrganizationMemberRoleEnum.TEACHER);
    const body = { rows: [{ name: 'X', phone: '01900000701', section: 'A' }] };
    expect((await preview(classId, body, orgToken(teacher, school, OrganizationMemberRoleEnum.TEACHER))).status).toBe(403);

    const otherOwner = await make.teacher({ personal_teacher_enabled: false });
    const other = await make.organization(otherOwner);
    expect((await preview(classId, body, orgToken(otherOwner, other, OrganizationMemberRoleEnum.OWNER))).status).toBe(404);
    expect((await preview(classId, { rows: [] })).status).toBe(400);
  });

  it('migration: a second run changes nothing', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const before = await t.dataSource.getRepository(EnrolmentEntity).count({ where: { invited_name: 'Invited Student' } });
    const runner = t.dataSource.createQueryRunner();
    try {
      await new EnrolmentInvitedName1755610000000().up(runner);
    } finally {
      await runner.release();
    }
    expect(await t.dataSource.getRepository(EnrolmentEntity).count({ where: { invited_name: 'Invited Student' } })).toBe(before);
  });
});
