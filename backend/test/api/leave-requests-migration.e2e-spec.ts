import { LeaveRequests1756250000000 } from '../../src/migrations/1756250000000-LeaveRequests';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

/**
 * Migration P3-06 (leave requests) on data shaped like beta before it: class sessions with records
 * and no leave table. Up creates `leave_requests` and the records' `leave_request_id` without
 * touching any record, runs safely twice, logs a count check, keeps the rules (dates in order, one
 * status set, the link set null if a request goes) and reverts, keeping LEAVE records as they are.
 */
describe('LeaveRequests migration', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;

  beforeAll(async () => {
    t = await createTestApp();
    make = factories(t.dataSource);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterAll(async () => {
    await t.close();
  });

  it('creates leave_requests and the record link, safely twice, and reverts', async () => {
    const owner = await make.teacher({ personal_teacher_enabled: false });
    const school = await make.organization(owner);
    await make.classOf(owner, { organization_id: school.id });
    const student = await make.student();
    const migration = new LeaveRequests1756250000000();
    const runner = t.dataSource.createQueryRunner();
    try {
      const exists = async () => (await runner.query(`SELECT to_regclass('public.leave_requests') IS NOT NULL AS e`))[0].e;
      const linkColumn = async () =>
        (await runner.query(`SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name = 'class_attendance_records' AND column_name = 'leave_request_id'`))[0].n;
      const [section] = await runner.query(`SELECT id, session_id FROM sections WHERE organization_id = $1 LIMIT 1`, [school.id]);
      const [slot] = await runner.query(
        `INSERT INTO routine_slots (organization_id, session_id, section_id, day_of_week, start_time, end_time) VALUES ($1, $2, $3, 6, '16:00', '17:30') RETURNING id`,
        [school.id, section.session_id, section.id],
      );

      await migration.down(runner);
      expect(await exists()).toBe(false);
      expect(await linkColumn()).toBe(0);
      // A closed session with an Absent and a Leave record, as P3-04 left them.
      const [session] = await runner.query(
        `INSERT INTO class_attendance (organization_id, section_id, routine_slot_id, date, starts_at, ends_at, status) VALUES ($1, $2, $3, '2026-11-07', '2026-11-07T10:00:00Z', '2026-11-07T11:30:00Z', 'CLOSED') RETURNING id`,
        [school.id, section.id, slot.id],
      );
      const [record] = await runner.query(
        `INSERT INTO class_attendance_records (organization_id, class_attendance_id, date, person_id, person_type, status, source) VALUES ($1, $2, '2026-11-07', $3, 'STUDENT', 'ABSENT', 'AUTO_ABSENT') RETURNING id`,
        [school.id, session.id, student.id],
      );
      await runner.query(
        `INSERT INTO class_attendance_records (organization_id, class_attendance_id, date, person_id, person_type, status, source) VALUES ($1, $2, '2026-11-07', $3, 'TEACHER', 'LEAVE', 'CORRECTION')`,
        [school.id, session.id, owner.id],
      );
      const recordsBefore = await runner.query(`SELECT id, status, source FROM class_attendance_records ORDER BY id`);

      const log = jest.spyOn(console, 'log');
      await migration.up(runner);
      await migration.up(runner);
      expect(log).toHaveBeenCalledWith('[LeaveRequests] leave requests: 0, attendance records: 2 (leave 1)');
      expect(await exists()).toBe(true);
      expect(await linkColumn()).toBe(1);
      expect(await runner.query(`SELECT id, status, source FROM class_attendance_records ORDER BY id`)).toEqual(recordsBefore);

      // The database keeps the rules: PENDING by default, dates in order, known statuses only.
      const request = (from: string, to: string) =>
        runner.query(
          `INSERT INTO leave_requests (organization_id, person_id, person_type, from_date, to_date, reason, applied_by) VALUES ($1, $2, 'STUDENT', $3, $4, 'Fever', $2) RETURNING id, status`,
          [school.id, student.id, from, to],
        );
      const [leave] = await request('2026-11-07', '2026-11-08');
      expect(leave.status).toBe('PENDING');
      await expect(request('2026-11-08', '2026-11-07')).rejects.toThrow(/CHK_leave_requests_dates/);
      await expect(runner.query(`UPDATE leave_requests SET status = 'DELETED' WHERE id = $1`, [leave.id])).rejects.toThrow(/leave_status/);
      await runner.query(`UPDATE class_attendance_records SET status = 'LEAVE', leave_request_id = $2 WHERE id = $1`, [record.id, leave.id]);
      await expect(
        runner.query(`UPDATE class_attendance_records SET leave_request_id = '00000000-0000-0000-0000-000000000001' WHERE id = $1`, [record.id]),
      ).rejects.toThrow(/FK_class_attendance_records_leave_request/);

      // Down goes back to P3-04's shape: the table and link go, the LEAVE records stay LEAVE.
      await migration.down(runner);
      expect(await exists()).toBe(false);
      expect(await linkColumn()).toBe(0);
      expect((await runner.query(`SELECT status FROM class_attendance_records WHERE id = $1`, [record.id]))[0].status).toBe('LEAVE');
      await migration.up(runner);
    } finally {
      await runner.release();
    }
  });
});
