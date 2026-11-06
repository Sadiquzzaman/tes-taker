import { DeepPartial } from 'typeorm';
import { GuardianEntity, GuardianRelationEnum } from '../../src/academics/entities/guardian.entity';
import { SectionEntity } from '../../src/academics/entities/section.entity';
import { AttendanceAlertsService } from '../../src/attendance/attendance-alerts.service';
import { AttendanceClock } from '../../src/attendance/attendance-clock';
import { AttendanceCorrectionEntity } from '../../src/attendance/entities/attendance-correction.entity';
import { AttendanceRecordEntity } from '../../src/attendance/entities/attendance-record.entity';
import { LeaveRequestEntity } from '../../src/attendance/entities/leave-request.entity';
import { SessionClosingService } from '../../src/attendance/session-closing.service';
import { AuditService } from '../../src/audit/audit.service';
import { AuditLogEntity } from '../../src/audit/entities/audit-log.entity';
import { HolidayEntity } from '../../src/calendar/entities/holiday.entity';
import { ClassEntity } from '../../src/classes/entities/class.entity';
import { RolesEnum } from '../../src/common/enums/roles.enum';
import { FileObjectEntity } from '../../src/files/entities/file-object.entity';
import { FileStatusEnum } from '../../src/files/file-rules';
import { NotificationOutboxEntity } from '../../src/notifications/entities/notification-outbox.entity';
import { NotificationDispatcherService } from '../../src/notifications/notification-dispatcher.service';
import { OutboxStatusEnum } from '../../src/notifications/notification.constants';
import { OrganizationEntity } from '../../src/organizations/entities/organization.entity';
import { OrganizationMemberRoleEnum } from '../../src/organizations/enums/organization-member-role.enum';
import { SmsService } from '../../src/sms/sms.service';
import { UserEntity } from '../../src/user/entities/user.entity';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

type Leave = {
  id: string;
  person: { id: string; full_name: string };
  person_type: string;
  class_name: string;
  from_date: string;
  to_date: string;
  school_days: number;
  status: string;
  applied_by: { id: string } | null;
  decided_by: { id: string } | null;
  decision_note: string | null;
  can_decide: boolean;
  can_cancel: boolean;
  file: { id: string } | null;
};
type Mine = { can_apply: boolean; person_type: string | null; can_apply_for_others: boolean; can_approve: boolean; requests: Leave[] };
type Body<T> = { payload: T; code?: string };

const SAT = 6;
const DATE = '2026-11-07'; // a Saturday; classes 16:00–17:30 in Dhaka (10:00–11:30 UTC); Friday is the weekly off day
const BEFORE = '2026-11-05T04:00:00Z'; // Thursday morning, before the class
const AFTER = `${DATE}T12:00:00Z`; // after check-in closed
const endOf = (date: string) => `${date}T17:59:00Z`;

/**
 * Leave requests and approvals (P3-06; ATT-09, ATT-11): who applies and who approves (class
 * teacher, else teachers, else owners and admins; owners and admins for teachers; never a student,
 * never one's own), tenancy, dates and overlaps, weekly off days and holidays, the guardian SMS on
 * apply when switched on, the in-app notices, the closing job saving LEAVE instead of Absent, Absent
 * turned into Leave when approved later (with corrections and audit), no Absent SMS on a day of
 * leave, withdrawing, the calendars, a solo workspace and the plan gate.
 */
describe('leave requests and approvals', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;
  let clock: AttendanceClock;
  let closing: SessionClosingService;
  let alerts: AttendanceAlertsService;
  let audit: AuditService;
  let admin: UserEntity;

  const orgSession = (user: UserEntity, organization: OrganizationEntity, role: OrganizationMemberRoleEnum) =>
    t.tokenFor(user, { session_mode: 'organization', context_type: 'organization', organization_id: organization.id, member_role: role });
  const call = <T>(method: string, path: string, token: string, body?: unknown) => t.api.request<Body<T>>(method, path, { token, body });
  const apply = (token: string, body: Record<string, unknown>) => call<Leave>('POST', '/attendance/leave', token, { reason: 'Fever', ...body });
  const approve = (token: string, id: string, note?: string) => call<Leave>('POST', `/attendance/leave/${id}/approve`, token, note ? { note } : {});
  const reject = (token: string, id: string, note?: string) => call<Leave>('POST', `/attendance/leave/${id}/reject`, token, note === undefined ? {} : { note });
  const cancel = (token: string, id: string) => call<Leave>('POST', `/attendance/leave/${id}/cancel`, token);
  const mine = (token: string) => call<Mine>('GET', '/attendance/leave/mine', token);
  const approvals = (token: string, status?: string) => call<Leave[]>('GET', `/attendance/leave/approvals${status ? `?status=${status}` : ''}`, token);
  const setNow = (iso: string) => jest.spyOn(clock, 'now').mockReturnValue(new Date(iso));
  const outbox = (organizationId: string, eventType: string) =>
    t.dataSource.getRepository(NotificationOutboxEntity).find({ where: { organization_id: organizationId, event_type: eventType }, order: { created_at: 'ASC' } });
  const recordOf = (sessionDate: string, personId: string) =>
    t.dataSource.getRepository(AttendanceRecordEntity).findOne({ where: { person_id: personId, date: sessionDate } });

  const feature = async (organization: OrganizationEntity, value: boolean) => {
    const response = await t.api.request('PUT', `/subscriptions/admin/organizations/${organization.id}/overrides/attendance`, {
      body: { value, reason: 'P3-06 test' },
      token: t.tokenFor(admin),
    });
    expect(response.status).toBe(200);
  };

  /**
   * A school: Class 8 A (class teacher Rina, who is also named on its slot) with Rahim and Karim;
   * Class 9 A (no class teacher) with Nila; both meet Saturdays 16:00–17:30. Also an admin, an
   * office staff member (ASSISTANT) and another teacher, Tamim. Rahim has a father (Bangla SMS).
   */
  const school = async () => {
    const owner = await make.teacher({ personal_teacher_enabled: false, full_name: 'Owner' });
    const organization = await make.organization(owner);
    await feature(organization, true);
    const ownerToken = orgSession(owner, organization, OrganizationMemberRoleEnum.OWNER);
    const newSection = async (name: string) => {
      const created = await call<{ id: string }>('POST', '/classes', ownerToken, { class_name: name });
      const classEntity = await t.dataSource.getRepository(ClassEntity).findOneByOrFail({ id: created.body.payload.id });
      const section = await t.dataSource.getRepository(SectionEntity).findOneByOrFail({ class_id: classEntity.id });
      return { classEntity, section };
    };
    const c8 = await newSection('Class 8');
    const c9 = await newSection('Class 9');
    const staff = async (name: string, role: OrganizationMemberRoleEnum) => {
      const user = await make.teacher({ personal_teacher_enabled: false, full_name: name });
      await make.member(organization, user, role);
      return { user, token: orgSession(user, organization, role) };
    };
    const rina = await staff('Rina Akter', OrganizationMemberRoleEnum.TEACHER);
    const tamim = await staff('Tamim', OrganizationMemberRoleEnum.TEACHER);
    const adminUser = await staff('Admin', OrganizationMemberRoleEnum.ADMIN);
    const office = await staff('Office', OrganizationMemberRoleEnum.ASSISTANT);
    await t.dataSource.query(`UPDATE sections SET class_teacher_id = $2 WHERE id = $1`, [c8.section.id, rina.user.id]);
    const student = async (name: string, classEntity: ClassEntity) => {
      const user = await make.student({ full_name: name });
      await make.member(organization, user, OrganizationMemberRoleEnum.STUDENT);
      const enrolment = await make.enrol(classEntity, user);
      await t.dataSource.query(`UPDATE enrolments SET joined_at = '2026-10-01T00:00:00Z' WHERE id = $1`, [enrolment.id]);
      return { user, token: orgSession(user, organization, OrganizationMemberRoleEnum.STUDENT) };
    };
    const rahim = await student('Rahim', c8.classEntity);
    const karim = await student('Karim', c8.classEntity);
    const nila = await student('Nila', c9.classEntity);
    const father = await t.dataSource.getRepository(GuardianEntity).save({
      organization_id: organization.id,
      student_id: rahim.user.id,
      name: 'Test Guardian',
      relation: GuardianRelationEnum.FATHER,
      phone: '01700000001',
      is_primary: true,
      sms_locale: 'bn',
    } as DeepPartial<GuardianEntity>);
    const karimMother = await t.dataSource.getRepository(GuardianEntity).save({
      organization_id: organization.id,
      student_id: karim.user.id,
      name: 'Test Guardian',
      relation: GuardianRelationEnum.MOTHER,
      phone: '01800000002',
      is_primary: true,
      sms_locale: 'en',
    } as DeepPartial<GuardianEntity>);
    const branches = await call<{ id: string; is_default: boolean }[]>('GET', '/attendance/branches', ownerToken);
    const main = branches.body.payload.find((b) => b.is_default) as { id: string };
    await call('PATCH', `/attendance/branches/${main.id}`, ownerToken, { geo_lat: 23.758, geo_lng: 90.389, checkin_radius_m: 100 });
    for (const [section, teacherId] of [[c8.section, rina.user.id], [c9.section, null]] as const) {
      const saved = await call('PUT', `/attendance/setup/sections/${section.id}/slots`, ownerToken, {
        slots: [{ day_of_week: SAT, start_time: '16:00', end_time: '17:30', teacher_id: teacherId }],
      });
      expect(saved.status).toBe(200);
    }
    await t.dataSource.query(`UPDATE routine_slots SET created_at = '2026-11-01 00:00:00' WHERE section_id IN ($1, $2)`, [c8.section.id, c9.section.id]);
    const slotOf = async (sectionId: string) =>
      ((await t.dataSource.query(`SELECT id FROM routine_slots WHERE section_id = $1 AND is_active = '1'`, [sectionId])) as { id: string }[])[0].id;
    return { owner, organization, ownerToken, rina, tamim, adminUser, office, rahim, karim, nila, father, karimMother, c8, c9, slot8: await slotOf(c8.section.id) };
  };

  beforeAll(async () => {
    t = await createTestApp();
    make = factories(t.dataSource);
    clock = t.app.get(AttendanceClock);
    closing = t.app.get(SessionClosingService);
    alerts = t.app.get(AttendanceAlertsService);
    audit = t.app.get(AuditService);
    admin = await make.user(RolesEnum.SUPER_ADMIN);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterAll(async () => {
    await t.close();
  });

  describe('applying (ATT-09)', () => {
    it("queues the guardian's SMS, tells the class teacher in-app, and is audited", async () => {
      const s = await school();
      setNow(BEFORE);
      const applied = await apply(s.rahim.token, { from_date: '2026-11-06', to_date: DATE, reason: 'Fever; the doctor asked for rest' });
      expect(applied.status).toBe(201);
      // Friday 6 Nov is the weekly off day: one school day.
      expect(applied.body.payload).toMatchObject({
        person: { id: s.rahim.user.id, full_name: 'Rahim' },
        person_type: 'STUDENT',
        class_name: 'Class 8 A',
        school_days: 1,
        status: 'PENDING',
        applied_by: { id: s.rahim.user.id },
        can_decide: false,
        can_cancel: true,
      });

      const sms = await outbox(s.organization.id, 'attendance.leave_applied');
      expect(sms.map((row) => [row.recipient_id, row.locale, row.channel])).toEqual([[s.father.id, 'bn', 'SMS']]);
      expect(sms[0].dedupe_key).toBe(`attendance.leave_applied:${applied.body.payload.id}:${s.father.id}`);
      const smsDeliver = jest.spyOn(t.app.get(SmsService), 'deliver').mockResolvedValue({ messageId: 'sms-1' });
      expect(await t.app.get(NotificationDispatcherService).dispatch(sms[0].id)).toBe(OutboxStatusEnum.SENT);
      expect(smsDeliver.mock.calls[0][1]).toContain('Rahim (Class 8 A)');
      expect(smsDeliver.mock.calls[0][1]).toContain('ছুটির আবেদন');

      // The class teacher (not the owner) is told in-app; nobody else.
      const notices = await outbox(s.organization.id, 'attendance.leave_requested');
      expect(notices.map((row) => [row.recipient_id, row.channel])).toEqual([[s.rina.user.id, 'IN_APP']]);

      await audit.flush();
      const logs = await t.dataSource.getRepository(AuditLogEntity).find({ where: { organization_id: s.organization.id, action: 'leave.apply' } });
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({ actor_id: s.rahim.user.id, entity_id: applied.body.payload.id });
      expect(logs[0].after).toMatchObject({ person_type: 'STUDENT', from_date: '2026-11-06', to_date: DATE, status: 'PENDING' });

      const own = (await mine(s.rahim.token)).body.payload;
      expect(own).toMatchObject({ can_apply: true, person_type: 'STUDENT', can_apply_for_others: false, can_approve: false });
      expect(own.requests.map((r) => r.id)).toEqual([applied.body.payload.id]);
    });

    it('sends no guardian SMS when the leave switch is off', async () => {
      const s = await school();
      expect((await call('PATCH', '/attendance/settings', s.ownerToken, { guardian_sms: { late: true, absent: true, leave: false } })).status).toBe(200);
      setNow(BEFORE);
      expect((await apply(s.rahim.token, { from_date: DATE, to_date: DATE })).status).toBe(201);
      expect(await outbox(s.organization.id, 'attendance.leave_applied')).toEqual([]);
      // The approvers are still told in-app.
      expect(await outbox(s.organization.id, 'attendance.leave_requested')).toHaveLength(1);
    });

    it('checks the dates, weekly off days and holidays, and overlaps', async () => {
      const s = await school();
      setNow(BEFORE);
      const code = async (body: Record<string, unknown>) => (await apply(s.karim.token, body)).body.code;
      expect(await code({ from_date: DATE, to_date: '2026-11-06' })).toBe('ATTENDANCE_LEAVE_DATES_INVALID');
      expect(await code({ from_date: '2026-11-07', to_date: '2027-01-06' })).toBe('ATTENDANCE_LEAVE_TOO_LONG');
      expect(await code({ from_date: '2026-10-05', to_date: '2026-10-05' })).toBe('ATTENDANCE_LEAVE_TOO_OLD');
      expect(await code({ from_date: '2027-11-07', to_date: '2027-11-07' })).toBe('ATTENDANCE_LEAVE_TOO_FAR');
      // A Friday alone is no school day; nor is a holiday.
      expect(await code({ from_date: '2026-11-06', to_date: '2026-11-06' })).toBe('ATTENDANCE_LEAVE_NO_SCHOOL_DAYS');
      await t.dataSource.getRepository(HolidayEntity).save({
        organization_id: s.organization.id,
        name: 'Test holiday',
        date_from: '2026-11-09',
        date_to: '2026-11-09',
      } as DeepPartial<HolidayEntity>);
      expect(await code({ from_date: '2026-11-09', to_date: '2026-11-09' })).toBe('ATTENDANCE_LEAVE_NO_SCHOOL_DAYS');
      // Thu 5 to Mon 9: Friday off and Monday a holiday leave three school days.
      const across = await apply(s.karim.token, { from_date: '2026-11-05', to_date: '2026-11-09' });
      expect(across.status).toBe(201);
      expect(across.body.payload.school_days).toBe(3);

      // Overlapping a waiting request is refused; after a rejection the days are free again.
      const clash = await apply(s.karim.token, { from_date: '2026-11-08', to_date: '2026-11-10' });
      expect(clash.status).toBe(409);
      expect(clash.body.code).toBe('ATTENDANCE_LEAVE_OVERLAP');
      expect((await reject(s.rina.token, across.body.payload.id, 'Exam week')).status).toBe(200);
      expect((await apply(s.karim.token, { from_date: '2026-11-08', to_date: '2026-11-10' })).status).toBe(201);
      // Another person's leave on the same days does not clash.
      expect((await apply(s.rahim.token, { from_date: '2026-11-08', to_date: '2026-11-10' })).status).toBe(201);
    });

    it("takes an attachment the applicant uploaded for leave, and no one else's file", async () => {
      const s = await school();
      setNow(BEFORE);
      const file = (ownerId: string, purpose: string) =>
        t.dataSource.getRepository(FileObjectEntity).save({
          organization_id: s.organization.id,
          owner_id: ownerId,
          purpose,
          s3_key: `org/${s.organization.id}/leave/${Math.random()}`,
          mime: 'application/pdf',
          original_name: 'note.pdf',
          size_bytes: 1000,
          original_size_bytes: 1000,
          status: FileStatusEnum.READY,
        } as DeepPartial<FileObjectEntity>);
      const others = await file(s.karim.user.id, 'LEAVE');
      const wrongPurpose = await file(s.rahim.user.id, 'IMAGE');
      expect((await apply(s.rahim.token, { from_date: DATE, to_date: DATE, file_id: others.id })).body.code).toBe('ATTENDANCE_LEAVE_FILE_INVALID');
      expect((await apply(s.rahim.token, { from_date: DATE, to_date: DATE, file_id: wrongPurpose.id })).body.code).toBe('ATTENDANCE_LEAVE_FILE_INVALID');
      const own = await file(s.rahim.user.id, 'LEAVE');
      const applied = await apply(s.rahim.token, { from_date: DATE, to_date: DATE, file_id: own.id });
      expect(applied.status).toBe(201);
      expect(applied.body.payload.file).toMatchObject({ id: own.id });
    });
  });

  describe('who approves (ATT-09, ATT-11)', () => {
    it("lets the class teacher, owners and admins decide a student's leave; never a student or another teacher", async () => {
      const s = await school();
      setNow(BEFORE);
      const leave = (await apply(s.rahim.token, { from_date: DATE, to_date: DATE })).body.payload;

      // A student cannot approve their own, nor see or approve a classmate's.
      expect((await approve(s.rahim.token, leave.id)).body.code).toBe('ATTENDANCE_LEAVE_OWN_REQUEST');
      expect((await approve(s.karim.token, leave.id)).status).toBe(404);
      expect((await approvals(s.karim.token)).body.payload).toEqual([]);
      // Tamim does not teach Class 8 A; the office staff apply for students but do not approve.
      expect((await approve(s.tamim.token, leave.id)).status).toBe(404);
      expect((await approvals(s.tamim.token)).body.payload).toEqual([]);
      expect((await approve(s.office.token, leave.id)).status).toBe(404);
      expect((await approvals(s.office.token)).body.payload).toEqual([]);

      // The class teacher, the admin and the owner see it waiting.
      for (const token of [s.rina.token, s.adminUser.token, s.ownerToken]) {
        const waiting = (await approvals(token)).body.payload;
        expect(waiting.map((r) => [r.id, r.can_decide])).toEqual([[leave.id, true]]);
      }
      expect((await mine(s.rina.token)).body.payload).toMatchObject({ can_approve: true, can_apply_for_others: true });
      expect((await mine(s.tamim.token)).body.payload).toMatchObject({ can_approve: false, can_apply_for_others: false });

      // A rejection needs a comment.
      expect((await reject(s.rina.token, leave.id)).status).toBe(400);
      const approved = await approve(s.rina.token, leave.id, 'Get well soon');
      expect(approved.status).toBe(200);
      expect(approved.body.payload).toMatchObject({ status: 'APPROVED', decided_by: { id: s.rina.user.id }, decision_note: 'Get well soon', can_decide: false });
      expect((await approve(s.ownerToken, leave.id)).body.code).toBe('ATTENDANCE_LEAVE_NOT_PENDING');
      expect((await approvals(s.rina.token)).body.payload).toEqual([]);
      expect((await approvals(s.rina.token, 'DECIDED')).body.payload.map((r) => r.id)).toEqual([leave.id]);

      // Rahim hears in-app.
      const decided = await outbox(s.organization.id, 'attendance.leave_approved');
      expect(decided.map((row) => row.recipient_id)).toEqual([s.rahim.user.id]);
      await audit.flush();
      const logs = await t.dataSource.getRepository(AuditLogEntity).find({ where: { organization_id: s.organization.id, action: 'leave.approve' } });
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({ actor_id: s.rina.user.id, entity_id: leave.id, reason: 'Get well soon' });
    });

    it('falls back to owners and admins when a section has no class teacher or teachers', async () => {
      const s = await school();
      setNow(BEFORE);
      const leave = (await apply(s.nila.token, { from_date: DATE, to_date: DATE })).body.payload;
      const notices = await outbox(s.organization.id, 'attendance.leave_requested');
      expect(notices.map((row) => row.recipient_id).sort()).toEqual([s.owner.id, s.adminUser.user.id].sort());
      // Rina is Class 8 A's class teacher, not Class 9 A's.
      expect((await approve(s.rina.token, leave.id)).status).toBe(404);
      expect((await approve(s.adminUser.token, leave.id)).status).toBe(200);
    });

    it("lets owners and admins decide a teacher's leave, never a teacher; an owner's own is approved at once", async () => {
      const s = await school();
      setNow(BEFORE);
      const leave = await apply(s.rina.token, { from_date: DATE, to_date: '2026-11-08' });
      expect(leave.status).toBe(201);
      expect(leave.body.payload).toMatchObject({ person_type: 'TEACHER', class_name: '', school_days: 2, status: 'PENDING' });
      expect((await outbox(s.organization.id, 'attendance.leave_requested')).map((row) => row.recipient_id).sort()).toEqual([s.owner.id, s.adminUser.user.id].sort());
      expect((await mine(s.rina.token)).body.payload).toMatchObject({ can_apply: true, person_type: 'TEACHER' });

      expect((await approve(s.rina.token, leave.body.payload.id)).body.code).toBe('ATTENDANCE_LEAVE_OWN_REQUEST');
      expect((await approve(s.tamim.token, leave.body.payload.id)).status).toBe(404);
      expect((await approve(s.office.token, leave.body.payload.id)).status).toBe(404);
      expect((await approve(s.adminUser.token, leave.body.payload.id)).status).toBe(200);

      // An admin's own leave waits for the owner; the owner's own is approved at once.
      const adminLeave = await apply(s.adminUser.token, { from_date: DATE, to_date: DATE });
      expect(adminLeave.body.payload.status).toBe('PENDING');
      expect((await approvals(s.adminUser.token)).body.payload.map((r) => r.id)).not.toContain(adminLeave.body.payload.id);
      const ownerLeave = await apply(s.ownerToken, { from_date: DATE, to_date: DATE });
      expect(ownerLeave.body.payload).toMatchObject({ status: 'APPROVED', decided_by: { id: s.owner.id } });
    });

    it('lets staff apply for a student: approved at once by an approver, waiting when office staff apply', async () => {
      const s = await school();
      setNow(BEFORE);
      const byTeacher = await apply(s.rina.token, { person_id: s.karim.user.id, from_date: DATE, to_date: DATE, reason: 'His mother called' });
      expect(byTeacher.status).toBe(201);
      expect(byTeacher.body.payload).toMatchObject({ person: { id: s.karim.user.id }, applied_by: { id: s.rina.user.id }, status: 'APPROVED' });
      // The guardian gets the SMS anyway; Karim hears that it is approved.
      expect((await outbox(s.organization.id, 'attendance.leave_applied')).map((row) => row.recipient_id)).toEqual([s.karimMother.id]);
      expect((await outbox(s.organization.id, 'attendance.leave_approved')).map((row) => row.recipient_id)).toEqual([s.karim.user.id]);
      expect((await mine(s.karim.token)).body.payload.requests.map((r) => r.id)).toEqual([byTeacher.body.payload.id]);

      const byOffice = await apply(s.office.token, { person_id: s.rahim.user.id, from_date: DATE, to_date: DATE });
      expect(byOffice.body.payload.status).toBe('PENDING');
      expect((await mine(s.office.token)).body.payload.requests.map((r) => r.id)).toEqual([byOffice.body.payload.id]);

      // Not for a student of another class, not by a student, not for an unknown person.
      expect((await apply(s.rina.token, { person_id: s.nila.user.id, from_date: DATE, to_date: DATE })).body.code).toBe('ATTENDANCE_LEAVE_NOT_ALLOWED');
      expect((await apply(s.karim.token, { person_id: s.rahim.user.id, from_date: '2026-11-08', to_date: '2026-11-08' })).body.code).toBe('ATTENDANCE_LEAVE_NOT_ALLOWED');
      expect((await apply(s.rina.token, { person_id: s.tamim.user.id, from_date: DATE, to_date: DATE })).body.code).toBe('ATTENDANCE_LEAVE_NOT_ALLOWED');
      expect((await apply(s.ownerToken, { person_id: admin.id, from_date: DATE, to_date: DATE })).body.code).toBe('ATTENDANCE_LEAVE_PERSON_NOT_FOUND');
      // Owners and admins apply for a teacher (approved at once).
      expect((await apply(s.ownerToken, { person_id: s.tamim.user.id, from_date: DATE, to_date: DATE })).body.payload).toMatchObject({ person_type: 'TEACHER', status: 'APPROVED' });

      // The people picker: a teacher sees their own students; owners see everyone and the staff.
      const people = (token: string, q = '') => call<{ students: { id: string }[]; staff: { id: string }[] }>('GET', `/attendance/leave/people?q=${q}`, token);
      expect((await people(s.rina.token)).body.payload.students.map((p) => p.id).sort()).toEqual([s.rahim.user.id, s.karim.user.id].sort());
      expect((await people(s.rina.token)).body.payload.staff).toEqual([]);
      expect((await people(s.ownerToken, 'nil')).body.payload.students.map((p) => p.id)).toEqual([s.nila.user.id]);
      expect((await people(s.ownerToken, 'tam')).body.payload.staff.map((p) => p.id)).toEqual([s.tamim.user.id]);
      expect((await people(s.karim.token)).body.payload).toEqual({ students: [], staff: [] });
    });

    it("never shows or changes another organisation's leave", async () => {
      const a = await school();
      const b = await school();
      setNow(BEFORE);
      const leave = (await apply(a.rahim.token, { from_date: DATE, to_date: DATE })).body.payload;
      expect((await call('GET', `/attendance/leave/${leave.id}`, b.ownerToken)).status).toBe(404);
      expect((await approve(b.ownerToken, leave.id)).status).toBe(404);
      expect((await cancel(b.ownerToken, leave.id)).status).toBe(404);
      expect((await approvals(b.ownerToken)).body.payload).toEqual([]);
      expect((await apply(b.ownerToken, { person_id: a.rahim.user.id, from_date: DATE, to_date: DATE })).body.code).toBe('ATTENDANCE_LEAVE_PERSON_NOT_FOUND');
      expect((await t.dataSource.getRepository(LeaveRequestEntity).findOneByOrFail({ id: leave.id })).status).toBe('PENDING');
    });
  });

  describe('withdrawing', () => {
    it('is a status change: waiting at any time, approved only before it starts', async () => {
      const s = await school();
      setNow(BEFORE);
      const waiting = (await apply(s.rahim.token, { from_date: DATE, to_date: DATE })).body.payload;
      const withdrawn = await cancel(s.rahim.token, waiting.id);
      expect(withdrawn.status).toBe(200);
      expect(withdrawn.body.payload).toMatchObject({ status: 'CANCELLED', can_cancel: false });
      expect((await cancel(s.rahim.token, waiting.id)).body.code).toBe('ATTENDANCE_LEAVE_CANNOT_CANCEL');
      // Never deleted.
      expect(await t.dataSource.getRepository(LeaveRequestEntity).countBy({ id: waiting.id })).toBe(1);
      // A waiting request withdrawn by the person just leaves the approvers' list: nobody is told.
      expect(await outbox(s.organization.id, 'attendance.leave_cancelled')).toEqual([]);

      const approved = (await apply(s.rina.token, { person_id: s.rahim.user.id, from_date: DATE, to_date: DATE })).body.payload;
      expect(approved.status).toBe('APPROVED');
      setNow(`${DATE}T03:00:00Z`); // the day itself: it has started
      expect((await cancel(s.rahim.token, approved.id)).body.code).toBe('ATTENDANCE_LEAVE_CANNOT_CANCEL');
      setNow(BEFORE);
      expect((await cancel(s.karim.token, approved.id)).status).toBe(404);
      expect((await cancel(s.rahim.token, approved.id)).body.payload.status).toBe('CANCELLED');
      // The class teacher who approved it hears it was withdrawn.
      expect((await outbox(s.organization.id, 'attendance.leave_cancelled')).map((row) => row.recipient_id)).toEqual([s.rina.user.id]);
      await audit.flush();
      expect(await t.dataSource.getRepository(AuditLogEntity).countBy({ organization_id: s.organization.id, action: 'leave.cancel' })).toBe(2);
    });
  });

  describe('attendance on leave days', () => {
    it('makes the closing job save LEAVE instead of Absent for students and teachers on approved leave', async () => {
      const s = await school();
      setNow(BEFORE);
      const rahimLeave = (await apply(s.rina.token, { person_id: s.rahim.user.id, from_date: DATE, to_date: DATE })).body.payload;
      const rinaLeave = (await apply(s.rina.token, { from_date: DATE, to_date: DATE })).body.payload;
      expect((await approve(s.ownerToken, rinaLeave.id)).status).toBe(200);
      // Karim's leave is still waiting: it does not count.
      await apply(s.karim.token, { from_date: DATE, to_date: DATE });

      setNow(AFTER);
      expect(await closing.closeOrganization(s.organization.id)).toEqual({ sessions_closed: 2, students_absent: 2, teachers_absent: 0, on_leave: 2 });
      expect(await recordOf(DATE, s.rahim.user.id)).toMatchObject({ status: 'LEAVE', source: 'AUTO_ABSENT', leave_request_id: rahimLeave.id });
      expect(await recordOf(DATE, s.rina.user.id)).toMatchObject({ status: 'LEAVE', person_type: 'TEACHER', leave_request_id: rinaLeave.id });
      expect(await recordOf(DATE, s.karim.user.id)).toMatchObject({ status: 'ABSENT', leave_request_id: null });
      expect(await recordOf(DATE, s.nila.user.id)).toMatchObject({ status: 'ABSENT' });
    });

    it('keeps a check-in made on a day of leave', async () => {
      const s = await school();
      setNow(BEFORE);
      await apply(s.rina.token, { person_id: s.rahim.user.id, from_date: DATE, to_date: DATE });
      setNow(`${DATE}T10:02:00Z`);
      const today = await call<{ on_leave: boolean; classes: { slot_id: string }[] }>('GET', '/attendance/me/today', s.rahim.token);
      expect(today.body.payload.on_leave).toBe(true);
      expect((await call('POST', '/attendance/check-in', s.rahim.token, { slot_id: s.slot8, latitude: 23.7581, longitude: 90.389, accuracy_m: 15 })).status).toBe(200);
      setNow(AFTER);
      await closing.closeOrganization(s.organization.id);
      expect(await recordOf(DATE, s.rahim.user.id)).toMatchObject({ status: 'PRESENT', leave_request_id: null });
    });

    it('turns Absent already saved into Leave when approved later, with a correction and the audit', async () => {
      const s = await school();
      setNow(AFTER);
      await closing.closeOrganization(s.organization.id);
      const before = await recordOf(DATE, s.rahim.user.id);
      expect(before?.status).toBe('ABSENT');

      setNow('2026-11-08T04:00:00Z'); // the next day: a sick note comes in
      const leave = (await apply(s.rahim.token, { from_date: DATE, to_date: DATE })).body.payload;
      expect((await approve(s.rina.token, leave.id)).status).toBe(200);
      const after = await recordOf(DATE, s.rahim.user.id);
      expect(after).toMatchObject({ id: before?.id, status: 'LEAVE', source: 'CORRECTION', leave_request_id: leave.id, updated_by: s.rina.user.id });
      const corrections = await t.dataSource.getRepository(AttendanceCorrectionEntity).find({ where: { record_id: before?.id } });
      expect(corrections.map((c) => [c.old_status, c.new_status, c.reason, c.corrected_by])).toEqual([['ABSENT', 'LEAVE', 'Approved leave', s.rina.user.id]]);
      // Karim's Absent is untouched.
      expect((await recordOf(DATE, s.karim.user.id))?.status).toBe('ABSENT');
      await audit.flush();
      const [log] = await t.dataSource.getRepository(AuditLogEntity).find({ where: { organization_id: s.organization.id, action: 'leave.approve' } });
      expect(log.after).toMatchObject({ status: 'APPROVED', absent_to_leave: 1 });

      // The class view counts Rahim as on leave, with the correction in his trail.
      const detail = await call<{ counts: { leave: number; absent: number }; students: { person: { id: string }; status: string; corrections: { reason: string }[] }[] }>(
        'GET',
        `/attendance/sessions/${s.slot8}/${DATE}`,
        s.rina.token,
      );
      expect(detail.body.payload.counts).toMatchObject({ leave: 1, absent: 1 });
      const row = detail.body.payload.students.find((r) => r.person.id === s.rahim.user.id);
      expect(row).toMatchObject({ status: 'LEAVE', corrections: [{ reason: 'Approved leave' }] });
    });

    it('sends no Absent SMS for a day fully on leave', async () => {
      const s = await school();
      setNow(BEFORE);
      await apply(s.rina.token, { person_id: s.rahim.user.id, from_date: DATE, to_date: DATE });
      setNow(endOf(DATE));
      const [result] = (await alerts.endOfDay()).filter((r) => r.organization_id === s.organization.id);
      expect(result).toMatchObject({ date: DATE, absent_students: 2, absent_sms: 1 });
      // Karim's mother is told; Rahim's father is not.
      expect((await outbox(s.organization.id, 'attendance.absent')).map((row) => row.recipient_id)).toEqual([s.karimMother.id]);
    });

    it('shows a class on a day of leave as Leave on the calendar before it is closed', async () => {
      const s = await school();
      setNow(BEFORE);
      await apply(s.rina.token, { person_id: s.rahim.user.id, from_date: DATE, to_date: DATE });
      type Calendar = { days: { date: string; classes: { status: string }[] }[]; counts: { leave: number }; attendance_pct: number | null };
      const calendar = (await call<Calendar>('GET', '/attendance/me/calendar?month=2026-11', s.rahim.token)).body.payload;
      expect(calendar.days.find((d) => d.date === DATE)?.classes.map((c) => c.status)).toEqual(['LEAVE']);
      expect(calendar.counts.leave).toBe(1);
      const karims = (await call<Calendar>('GET', '/attendance/me/calendar?month=2026-11', s.karim.token)).body.payload;
      expect(karims.days.find((d) => d.date === DATE)?.classes.map((c) => c.status)).toEqual(['UPCOMING']);
      // The teacher's class view counts him on leave while the class is upcoming.
      const list = await call<{ sessions: { slot_id: string; counts: { leave: number; waiting: number } }[] }>('GET', `/attendance/sessions?date=${DATE}`, s.rina.token);
      expect(list.body.payload.sessions.find((x) => x.slot_id === s.slot8)?.counts).toMatchObject({ leave: 1, waiting: 1 });
    });
  });

  describe('workspaces and the plan', () => {
    it("lets a solo teacher's student apply and the teacher approve; the solo teacher has no leave of their own", async () => {
      const teacher = await make.teacher();
      const solo = await make.soloOrganization(teacher);
      await feature(solo, true);
      const teacherToken = t.tokenFor(teacher);
      const created = await call<{ id: string }>('POST', '/classes', teacherToken, { class_name: 'IELTS batch' });
      const student = await make.student({ full_name: 'Sumi' });
      await make.enrol({ id: created.body.payload.id }, student);
      const studentToken = t.tokenFor(student, { context_type: 'individual_teacher', teacher_id: teacher.id });
      setNow(BEFORE);

      const leave = await apply(studentToken, { from_date: DATE, to_date: DATE });
      expect(leave.status).toBe(201);
      expect(leave.body.payload.status).toBe('PENDING');
      expect((await outbox(solo.id, 'attendance.leave_requested')).map((row) => row.recipient_id)).toEqual([teacher.id]);
      expect((await approve(teacherToken, leave.body.payload.id)).body.payload.status).toBe('APPROVED');
      expect((await apply(teacherToken, { from_date: DATE, to_date: DATE })).body.code).toBe('ATTENDANCE_LEAVE_NOT_ALLOWED');
      expect((await mine(teacherToken)).body.payload).toMatchObject({ can_apply: false, can_approve: true });
    });

    it('needs the attendance feature', async () => {
      const s = await school();
      await feature(s.organization, false);
      setNow(BEFORE);
      expect((await apply(s.rahim.token, { from_date: DATE, to_date: DATE })).status).toBe(403);
      expect((await mine(s.rahim.token)).status).toBe(403);
      expect(await t.dataSource.getRepository(LeaveRequestEntity).countBy({ organization_id: s.organization.id })).toBe(0);
    });
  });
});
