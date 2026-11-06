import { DeepPartial } from 'typeorm';
import { GuardianEntity, GuardianRelationEnum } from '../../src/academics/entities/guardian.entity';
import { SectionEntity } from '../../src/academics/entities/section.entity';
import { AttendanceAlertsService } from '../../src/attendance/attendance-alerts.service';
import { AttendanceClock } from '../../src/attendance/attendance-clock';
import { HolidayEntity } from '../../src/calendar/entities/holiday.entity';
import { ClassEntity } from '../../src/classes/entities/class.entity';
import { RolesEnum } from '../../src/common/enums/roles.enum';
import { NotificationOutboxEntity } from '../../src/notifications/entities/notification-outbox.entity';
import { NotificationDispatcherService } from '../../src/notifications/notification-dispatcher.service';
import { OutboxStatusEnum } from '../../src/notifications/notification.constants';
import { OrganizationEntity } from '../../src/organizations/entities/organization.entity';
import { OrganizationMemberRoleEnum } from '../../src/organizations/enums/organization-member-role.enum';
import { SmsService } from '../../src/sms/sms.service';
import { FeatureOverrideEntity } from '../../src/subscriptions/entities/feature-override.entity';
import { EntitlementsService } from '../../src/subscriptions/entitlements.service';
import { UserEntity } from '../../src/user/entities/user.entity';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

type Body<T> = { payload: T; code?: string };

const SAT = 6;
const DATE = '2026-11-07'; // a Saturday
/** 23:59 in Dhaka on a school date. */
const endOf = (date: string) => `${date}T17:59:00Z`;
const PIN = { lat: 23.758, lng: 90.389 };
const near = { latitude: PIN.lat + 0.0001, longitude: PIN.lng, accuracy_m: 15 };

/**
 * Guardian SMS and the repeated-absence alert (P3-04; ATT-06, ATT-10, ATT-14): the Late SMS at once,
 * once a day; the Absent SMS once a day only when every class that day was missed, from 23:59 (and
 * until 08:00 after an outage); the guardian_sms switches; no credit; closed days, cancelled and
 * paper-register classes; jobs run twice; the alert at the threshold, once per streak; tenancy.
 */
describe('attendance guardian SMS and repeated-absence alert', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;
  let clock: AttendanceClock;
  let alerts: AttendanceAlertsService;
  let dispatcher: NotificationDispatcherService;
  let admin: UserEntity;
  let smsDeliver: jest.SpyInstance;

  const orgSession = (user: UserEntity, organization: OrganizationEntity, role: OrganizationMemberRoleEnum) =>
    t.tokenFor(user, { session_mode: 'organization', context_type: 'organization', organization_id: organization.id, member_role: role });
  const call = <T>(method: string, path: string, token: string, body?: unknown) => t.api.request<Body<T>>(method, path, { token, body });
  const setNow = (iso: string) => jest.spyOn(clock, 'now').mockReturnValue(new Date(iso));
  /** The end-of-day results of one organisation (the job runs for every organisation in the test database). */
  const endOfDayFor = async (organization: OrganizationEntity) => (await alerts.endOfDay()).filter((r) => r.organization_id === organization.id);
  const outbox = (organizationId: string, eventType: string) =>
    t.dataSource.getRepository(NotificationOutboxEntity).find({ where: { organization_id: organizationId, event_type: eventType }, order: { created_at: 'ASC' } });

  const feature = async (organization: OrganizationEntity, value: boolean) => {
    const response = await t.api.request('PUT', `/subscriptions/admin/organizations/${organization.id}/overrides/attendance`, {
      body: { value, reason: 'P3-04 test' },
      token: t.tokenFor(admin),
    });
    expect(response.status).toBe(200);
  };

  /**
   * A school with 20 SMS credits a month: Class 8 A meets Saturdays 16:00–17:30 (teacher Rina named),
   * Class 9 A Saturdays 18:00–19:00. Rahim is in both, Karim in Class 8 A only. Rahim has a father
   * (Bangla SMS) and a removed guardian; Karim has a mother (English).
   */
  const school = async ({ credits = 20 } = {}) => {
    const owner = await make.teacher({ personal_teacher_enabled: false });
    const organization = await make.organization(owner);
    await feature(organization, true);
    await t.dataSource
      .getRepository(FeatureOverrideEntity)
      .save({ organization_id: organization.id, key: 'sms_credits_per_month', value: credits } as DeepPartial<FeatureOverrideEntity>);
    await t.app.get(EntitlementsService).invalidate(organization.id);
    const ownerToken = orgSession(owner, organization, OrganizationMemberRoleEnum.OWNER);
    const newSection = async (name: string) => {
      const created = await call<{ id: string }>('POST', '/classes', ownerToken, { class_name: name });
      const classEntity = await t.dataSource.getRepository(ClassEntity).findOneByOrFail({ id: created.body.payload.id });
      const section = await t.dataSource.getRepository(SectionEntity).findOneByOrFail({ class_id: classEntity.id });
      return { classEntity, section };
    };
    const c8 = await newSection('Class 8');
    const c9 = await newSection('Class 9');
    const teacher = await make.teacher({ personal_teacher_enabled: false, full_name: 'Rina Akter' });
    await make.member(organization, teacher, OrganizationMemberRoleEnum.TEACHER);
    const student = async (name: string, classes: ClassEntity[]) => {
      const user = await make.student({ full_name: name });
      await make.member(organization, user, OrganizationMemberRoleEnum.STUDENT);
      for (const classEntity of classes) {
        const enrolment = await make.enrol(classEntity, user);
        await t.dataSource.query(`UPDATE enrolments SET joined_at = '2026-10-01T00:00:00Z' WHERE id = $1`, [enrolment.id]);
      }
      return { user, token: orgSession(user, organization, OrganizationMemberRoleEnum.STUDENT) };
    };
    const rahim = await student('Rahim', [c8.classEntity, c9.classEntity]);
    const karim = await student('Karim', [c8.classEntity]);
    const guardian = (studentId: string, phone: string, extra: Partial<GuardianEntity> = {}) =>
      t.dataSource.getRepository(GuardianEntity).save({
        organization_id: organization.id,
        student_id: studentId,
        name: 'Test Guardian',
        relation: GuardianRelationEnum.FATHER,
        phone,
        is_primary: !extra.deleted_at,
        sms_locale: null,
        ...extra,
      } as DeepPartial<GuardianEntity>);
    const father = await guardian(rahim.user.id, '01700000001', { sms_locale: 'bn' });
    await guardian(rahim.user.id, '01700000009', { deleted_at: new Date('2026-10-15T00:00:00Z'), relation: GuardianRelationEnum.OTHER });
    const mother = await guardian(karim.user.id, '01800000002', { sms_locale: 'en', relation: GuardianRelationEnum.MOTHER });

    const branches = await call<{ id: string; is_default: boolean }[]>('GET', '/attendance/branches', ownerToken);
    const main = branches.body.payload.find((b) => b.is_default) as { id: string };
    await call('PATCH', `/attendance/branches/${main.id}`, ownerToken, { geo_lat: PIN.lat, geo_lng: PIN.lng, checkin_radius_m: 100 });
    for (const [section, start, end, teacherId] of [[c8.section, '16:00', '17:30', teacher.id], [c9.section, '18:00', '19:00', null]] as const) {
      const saved = await call('PUT', `/attendance/setup/sections/${section.id}/slots`, ownerToken, {
        slots: [{ day_of_week: SAT, start_time: start, end_time: end, teacher_id: teacherId }],
      });
      expect(saved.status).toBe(200);
    }
    await t.dataSource.query(`UPDATE routine_slots SET created_at = '2026-11-01 00:00:00' WHERE section_id IN ($1, $2)`, [c8.section.id, c9.section.id]);
    const slotOf = async (sectionId: string) =>
      ((await t.dataSource.query(`SELECT id FROM routine_slots WHERE section_id = $1 AND is_active = '1'`, [sectionId])) as { id: string }[])[0].id;
    return { owner, organization, ownerToken, teacher, rahim, karim, father, mother, c8, c9, slot8: await slotOf(c8.section.id), slot9: await slotOf(c9.section.id) };
  };
  type School = Awaited<ReturnType<typeof school>>;

  /** Check in at a time (UTC). */
  const checkIn = async (s: School, who: 'rahim' | 'karim', slot: string, at: string) => {
    setNow(at);
    const response = await call('POST', '/attendance/check-in', s[who].token, { slot_id: slot, ...near });
    expect(response.status).toBe(200);
  };

  beforeAll(async () => {
    t = await createTestApp();
    make = factories(t.dataSource);
    clock = t.app.get(AttendanceClock);
    alerts = t.app.get(AttendanceAlertsService);
    dispatcher = t.app.get(NotificationDispatcherService);
    admin = await make.user(RolesEnum.SUPER_ADMIN);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  beforeEach(() => {
    smsDeliver = jest.spyOn(t.app.get(SmsService), 'deliver').mockResolvedValue({ messageId: 'sms-1' });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterAll(async () => {
    await t.close();
  });

  describe('Late SMS (ATT-06)', () => {
    it("goes to the student's live guardians at once, in their language, once per day", async () => {
      const s = await school();
      await checkIn(s, 'rahim', s.slot8, `${DATE}T10:24:00Z`); // 16:24, 24 minutes late
      const rows = await outbox(s.organization.id, 'attendance.late');
      expect(rows).toHaveLength(1); // the removed guardian is not messaged
      expect(rows[0]).toMatchObject({ channel: 'SMS', recipient_type: 'GUARDIAN', recipient_id: s.father.id, to_address: '01700000001', locale: 'bn' });

      expect(await dispatcher.dispatch(rows[0].id)).toBe(OutboxStatusEnum.SENT);
      const [, text] = smsDeliver.mock.calls[0] as [string, string];
      expect(smsDeliver.mock.calls[0][0]).toBe('01700000001');
      expect(text).toContain('Rahim (Class 8 A)');
      expect(text).toContain('দেরিতে');

      // Late again in the second class that day: no second SMS.
      await checkIn(s, 'rahim', s.slot9, `${DATE}T12:30:00Z`);
      expect(await outbox(s.organization.id, 'attendance.late')).toHaveLength(1);
      // On time: no SMS.
      await checkIn(s, 'karim', s.slot8, `${DATE}T10:05:00Z`);
      expect((await outbox(s.organization.id, 'attendance.late')).map((r) => r.recipient_id)).toEqual([s.father.id]);
    });

    it('is not sent when the Late SMS is switched off, and is logged as no credit at zero credits', async () => {
      const off = await school();
      expect((await call('PATCH', '/attendance/settings', off.ownerToken, { guardian_sms: { late: false, absent: true, leave: true } })).status).toBe(200);
      await checkIn(off, 'rahim', off.slot8, `${DATE}T10:24:00Z`);
      expect(await outbox(off.organization.id, 'attendance.late')).toEqual([]);

      const broke = await school({ credits: 0 });
      await checkIn(broke, 'karim', broke.slot8, `${DATE}T10:30:00Z`);
      const [row] = await outbox(broke.organization.id, 'attendance.late');
      expect(await dispatcher.dispatch(row.id)).toBe(OutboxStatusEnum.NO_CREDIT);
      expect(smsDeliver).not.toHaveBeenCalled();
    });
  });

  describe('Absent SMS (ATT-10)', () => {
    it('goes once, from 23:59, only to guardians of students who missed every class that day', async () => {
      const s = await school();
      // Karim misses his only class; Rahim attends Class 9 A but not Class 8 A.
      await checkIn(s, 'rahim', s.slot9, `${DATE}T12:05:00Z`);

      setNow(`${DATE}T17:00:00Z`); // 23:00: not yet
      expect(await endOfDayFor(s.organization)).toEqual([]);

      setNow(endOf(DATE));
      const [first] = await endOfDayFor(s.organization);
      expect(first).toMatchObject({ date: DATE, absent_students: 1, absent_sms: 1 });
      const rows = await outbox(s.organization.id, 'attendance.absent');
      expect(rows.map((r) => [r.recipient_id, r.locale])).toEqual([[s.mother.id, 'en']]);
      expect(await dispatcher.dispatch(rows[0].id)).toBe(OutboxStatusEnum.SENT);
      expect(smsDeliver.mock.calls[0][1]).toContain('Karim (Class 8 A) was absent from class on 7 Nov.');

      // Every later run that night (and the closing job) sends nothing more.
      setNow(`${DATE}T18:30:00Z`);
      await alerts.endOfDay();
      await alerts.endOfDay();
      expect(await outbox(s.organization.id, 'attendance.absent')).toHaveLength(1);
    });

    it('sends after a worker outage until 08:00 the next morning, not later', async () => {
      const late = await school();
      setNow('2026-11-08T01:30:00Z'); // 07:30 on Sunday
      const [result] = await endOfDayFor(late.organization);
      expect(result).toMatchObject({ date: DATE, absent_students: 2, absent_sms: 2 });

      const later = await school();
      setNow('2026-11-08T02:30:00Z'); // 08:30: too late, nothing for the day before
      expect(await endOfDayFor(later.organization)).toEqual([]);
      expect(await outbox(later.organization.id, 'attendance.absent')).toEqual([]);
      expect(await outbox(late.organization.id, 'attendance.absent')).toHaveLength(2);
    });

    it('is not sent when switched off, at no credit it is logged, and never on a holiday', async () => {
      const off = await school();
      expect((await call('PATCH', '/attendance/settings', off.ownerToken, { guardian_sms: { late: true, absent: false, leave: true } })).status).toBe(200);
      const broke = await school({ credits: 0 });
      const holiday = await school();
      await t.dataSource.getRepository(HolidayEntity).save({ organization_id: holiday.organization.id, date_from: DATE, date_to: DATE, name: 'Closed' } as DeepPartial<HolidayEntity>);
      setNow(endOf(DATE));
      await alerts.endOfDay();
      expect(await outbox(off.organization.id, 'attendance.absent')).toEqual([]);
      expect(await outbox(holiday.organization.id, 'attendance.absent')).toEqual([]);
      const rows = await outbox(broke.organization.id, 'attendance.absent');
      expect(rows).toHaveLength(2);
      for (const row of rows) expect(await dispatcher.dispatch(row.id)).toBe(OutboxStatusEnum.NO_CREDIT);
      expect(smsDeliver).not.toHaveBeenCalled();
    });

    it('counts only classes held: a cancelled class is not missed, a paper register not in yet holds the SMS back', async () => {
      const s = await school();
      // Class 8 A cancelled: Rahim missed Class 9 A, the only class held, so he was absent all day; Karim had no class.
      setNow(`${DATE}T08:00:00Z`);
      expect((await call('POST', `/attendance/sessions/${s.slot8}/${DATE}/cancel`, s.ownerToken, {})).status).toBe(200);
      setNow(endOf(DATE));
      await alerts.endOfDay();
      expect((await outbox(s.organization.id, 'attendance.absent')).map((r) => r.recipient_id)).toEqual([s.father.id]);

      // The next Saturday Class 9 A keeps a paper register: Rahim's day is not known, Karim's is.
      expect((await call('PATCH', `/attendance/setup/sections/${s.c9.section.id}`, s.ownerToken, { mode: 'PAPER_REGISTER' })).status).toBe(200);
      setNow(endOf('2026-11-14'));
      const [result] = await endOfDayFor(s.organization);
      expect(result).toMatchObject({ date: '2026-11-14', absent_students: 1, absent_sms: 1 });
      expect((await outbox(s.organization.id, 'attendance.absent')).map((r) => r.recipient_id)).toEqual([s.father.id, s.mother.id]);
    });

    it("never messages another organisation's guardians, nor an organisation without the attendance feature", async () => {
      const on = await school();
      const off = await school();
      await feature(off.organization, false);
      setNow(endOf(DATE));
      const results = await alerts.endOfDay();
      expect(results.filter((r) => r.organization_id === on.organization.id)).toHaveLength(1);
      expect(results.filter((r) => r.organization_id === off.organization.id)).toEqual([]);
      const rows = await outbox(on.organization.id, 'attendance.absent');
      expect(rows.map((r) => r.recipient_id).sort()).toEqual([on.father.id, on.mother.id].sort());
      expect(await outbox(off.organization.id, 'attendance.absent')).toEqual([]);
    });
  });

  describe('repeated-absence alert (ATT-14)', () => {
    it('alerts the teacher in-app once a student misses every class on 3 school days in a row, once per streak', async () => {
      const s = await school();
      // Karim misses Saturdays 7, 14 and 21 Nov (his only class days); Rahim attends on 14 Nov.
      for (const date of [DATE, '2026-11-14', '2026-11-21']) {
        if (date === '2026-11-14') await checkIn(s, 'rahim', s.slot8, `${date}T10:05:00Z`);
        setNow(endOf(date));
        await alerts.endOfDay();
        const count = (await outbox(s.organization.id, 'attendance.repeat_absence')).length;
        expect(count).toBe(date === '2026-11-21' ? 1 : 0);
      }
      const [alert] = await outbox(s.organization.id, 'attendance.repeat_absence');
      // No class teacher or subject teachers here: the teacher named on the class's slot.
      expect(alert).toMatchObject({ channel: 'IN_APP', recipient_id: s.teacher.id });
      expect(alert.payload).toMatchObject({ student_id: s.karim.user.id, days: 3, since_on: DATE, class_name: 'Class 8 A', path: '/attendance' });
      await dispatcher.dispatch(alert.id);
      const [inbox] = await t.dataSource.query(`SELECT title, body FROM notifications WHERE user_id = $1`, [s.teacher.id]);
      expect(inbox.body).toContain('Karim (Class 8 A)');

      // A 4th absent Saturday is the same streak: no new alert.
      setNow(endOf('2026-11-28'));
      await alerts.endOfDay();
      await alerts.endOfDay();
      expect(await outbox(s.organization.id, 'attendance.repeat_absence')).toHaveLength(1);
    });

    it('uses the organisation threshold, prefers the class teacher, and starts a new streak after a class attended', async () => {
      const s = await school();
      expect((await call('PATCH', '/attendance/settings', s.ownerToken, { repeat_absence_days: 2 })).status).toBe(200);
      const classTeacher = await make.teacher({ personal_teacher_enabled: false, full_name: 'Class Teacher' });
      await make.member(s.organization, classTeacher, OrganizationMemberRoleEnum.TEACHER);
      await t.dataSource.query(`UPDATE sections SET class_teacher_id = $2 WHERE id IN ($1, $3)`, [s.c8.section.id, classTeacher.id, s.c9.section.id]);

      for (const date of [DATE, '2026-11-14']) {
        setNow(endOf(date));
        await alerts.endOfDay();
      }
      const first = await outbox(s.organization.id, 'attendance.repeat_absence');
      // Both students missed every class two Saturdays in a row.
      expect(first.map((r) => [r.recipient_id, (r.payload as { student_id: string }).student_id]).sort()).toEqual(
        [[classTeacher.id, s.karim.user.id], [classTeacher.id, s.rahim.user.id]].sort(),
      );

      // Karim attends on 21 Nov, then misses 28 Nov and 5 Dec: a new streak, a new alert.
      await checkIn(s, 'karim', s.slot8, '2026-11-21T10:05:00Z');
      for (const date of ['2026-11-21', '2026-11-28', '2026-12-05']) {
        setNow(endOf(date));
        await alerts.endOfDay();
      }
      const karim = (await outbox(s.organization.id, 'attendance.repeat_absence')).filter((r) => (r.payload as { student_id: string }).student_id === s.karim.user.id);
      expect(karim.map((r) => (r.payload as { since_on: string }).since_on)).toEqual([DATE, '2026-11-28']);
    });
  });
});
