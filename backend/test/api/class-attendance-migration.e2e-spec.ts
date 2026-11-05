import { ClassAttendance1756230000000 } from '../../src/migrations/1756230000000-ClassAttendance';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

/**
 * Migration P3-03 (class sessions, records and corrections) on data shaped like beta before it:
 * sections with schedules and no attendance. Up creates the three empty tables without touching the
 * schedules, runs safely twice, keeps the rules in the database, and reverts.
 */
describe('ClassAttendance migration', () => {
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

  it('creates class_attendance, class_attendance_records and attendance_corrections, safely twice, and reverts', async () => {
    const owner = await make.teacher({ personal_teacher_enabled: false });
    const school = await make.organization(owner);
    await make.classOf(owner, { organization_id: school.id });
    const student = await make.student();
    const migration = new ClassAttendance1756230000000();
    const runner = t.dataSource.createQueryRunner();
    try {
      const exists = async (table: string) => (await runner.query(`SELECT to_regclass($1) IS NOT NULL AS e`, [`public.${table}`]))[0].e;
      const [section] = await runner.query(`SELECT id, session_id FROM sections WHERE organization_id = $1 LIMIT 1`, [school.id]);
      const [slot] = await runner.query(
        `INSERT INTO routine_slots (organization_id, session_id, section_id, day_of_week, start_time, end_time) VALUES ($1, $2, $3, 6, '16:00', '17:30') RETURNING id`,
        [school.id, section.session_id, section.id],
      );
      const slotsBefore = await runner.query(`SELECT id, day_of_week, start_time, end_time FROM routine_slots ORDER BY id`);

      await migration.down(runner);
      for (const table of ['class_attendance', 'class_attendance_records', 'attendance_corrections']) expect(await exists(table)).toBe(false);

      const log = jest.spyOn(console, 'log');
      await migration.up(runner);
      await migration.up(runner);
      expect(log).toHaveBeenCalledWith(`[ClassAttendance] routine slots: ${slotsBefore.length}, class sessions: 0, records: 0, corrections: 0`);
      expect(await runner.query(`SELECT id, day_of_week, start_time, end_time FROM routine_slots ORDER BY id`)).toEqual(slotsBefore);

      // The database keeps the rules: one session per slot and date, end after start, one record per person, a reason per correction.
      const session = (start: string, end: string) =>
        runner.query(
          `INSERT INTO class_attendance (organization_id, section_id, routine_slot_id, date, starts_at, ends_at) VALUES ($1, $2, $3, '2026-11-07', $4, $5) RETURNING id, status`,
          [school.id, section.id, slot.id, start, end],
        );
      const [created] = await session('2026-11-07T10:00:00Z', '2026-11-07T11:30:00Z');
      expect(created.status).toBe('SCHEDULED');
      await expect(session('2026-11-07T10:00:00Z', '2026-11-07T11:30:00Z')).rejects.toThrow(/UQ_class_attendance_slot_date/);
      await runner.query(`DELETE FROM class_attendance WHERE id = $1`, [created.id]);
      await expect(session('2026-11-07T11:30:00Z', '2026-11-07T10:00:00Z')).rejects.toThrow(/CHK_class_attendance_times/);
      const [kept] = await session('2026-11-07T10:00:00Z', '2026-11-07T11:30:00Z');
      const record = () =>
        runner.query(
          `INSERT INTO class_attendance_records (organization_id, class_attendance_id, date, person_id, person_type, status, source) VALUES ($1, $2, '2026-11-07', $3, 'STUDENT', 'PRESENT', 'SELF') RETURNING id`,
          [school.id, kept.id, student.id],
        );
      const [saved] = await record();
      await expect(record()).rejects.toThrow(/UQ_class_attendance_records_person/);
      await expect(
        runner.query(`INSERT INTO attendance_corrections (organization_id, record_id, new_status) VALUES ($1, $2, 'ABSENT')`, [school.id, saved.id]),
      ).rejects.toThrow(/reason/);

      await migration.down(runner);
      expect(await exists('class_attendance')).toBe(false);
      await migration.up(runner);
    } finally {
      await runner.release();
    }
  });
});
