import { ClassSessionCloseCancel1756240000000 } from '../../src/migrations/1756240000000-ClassSessionCloseCancel';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

/**
 * Migration P3-04 (closing and cancelling class sessions) on data shaped like beta before it: class
 * sessions with check-ins and no closing columns. Up adds the nullable columns without touching any
 * session or record, runs safely twice, logs a count check, keeps the canceller link, and reverts.
 */
describe('ClassSessionCloseCancel migration', () => {
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

  it('adds closed_at and the cancellation columns, safely twice, and reverts', async () => {
    const owner = await make.teacher({ personal_teacher_enabled: false });
    const school = await make.organization(owner);
    await make.classOf(owner, { organization_id: school.id });
    const student = await make.student();
    const migration = new ClassSessionCloseCancel1756240000000();
    const runner = t.dataSource.createQueryRunner();
    try {
      const columns = async () =>
        (
          (await runner.query(
            `SELECT column_name FROM information_schema.columns WHERE table_name = 'class_attendance' AND column_name IN ('closed_at', 'cancelled_at', 'cancelled_by', 'cancel_note') ORDER BY column_name`,
          )) as { column_name: string }[]
        ).map((row) => row.column_name);
      const [section] = await runner.query(`SELECT id, session_id FROM sections WHERE organization_id = $1 LIMIT 1`, [school.id]);
      const [slot] = await runner.query(
        `INSERT INTO routine_slots (organization_id, session_id, section_id, day_of_week, start_time, end_time) VALUES ($1, $2, $3, 6, '16:00', '17:30') RETURNING id`,
        [school.id, section.session_id, section.id],
      );

      await migration.down(runner);
      expect(await columns()).toEqual([]);
      // A session with a check-in, as P3-03 left them.
      const [session] = await runner.query(
        `INSERT INTO class_attendance (organization_id, section_id, routine_slot_id, date, starts_at, ends_at) VALUES ($1, $2, $3, '2026-11-07', '2026-11-07T10:00:00Z', '2026-11-07T11:30:00Z') RETURNING id`,
        [school.id, section.id, slot.id],
      );
      await runner.query(
        `INSERT INTO class_attendance_records (organization_id, class_attendance_id, date, person_id, person_type, status, source) VALUES ($1, $2, '2026-11-07', $3, 'STUDENT', 'PRESENT', 'SELF')`,
        [school.id, session.id, student.id],
      );
      const before = await runner.query(`SELECT id, status, starts_at, ends_at FROM class_attendance ORDER BY id`);
      const recordsBefore = await runner.query(`SELECT id, status, source FROM class_attendance_records ORDER BY id`);

      const log = jest.spyOn(console, 'log');
      await migration.up(runner);
      await migration.up(runner);
      expect(log).toHaveBeenCalledWith('[ClassSessionCloseCancel] class sessions: 1 (scheduled 1, closed 0, cancelled 0)');
      expect(await columns()).toEqual(['cancel_note', 'cancelled_at', 'cancelled_by', 'closed_at']);
      expect(await runner.query(`SELECT id, status, starts_at, ends_at FROM class_attendance ORDER BY id`)).toEqual(before);
      expect(await runner.query(`SELECT id, status, source FROM class_attendance_records ORDER BY id`)).toEqual(recordsBefore);
      const [fresh] = await runner.query(`SELECT closed_at, cancelled_at, cancelled_by, cancel_note FROM class_attendance WHERE id = $1`, [session.id]);
      expect(fresh).toEqual({ closed_at: null, cancelled_at: null, cancelled_by: null, cancel_note: null });

      // The canceller is a user; a removed user leaves the cancellation without a name.
      await runner.query(`UPDATE class_attendance SET status = 'CANCELLED', cancelled_at = now(), cancelled_by = $2, cancel_note = 'Unwell' WHERE id = $1`, [session.id, owner.id]);
      await expect(
        runner.query(`UPDATE class_attendance SET cancelled_by = '00000000-0000-0000-0000-000000000001' WHERE id = $1`, [session.id]),
      ).rejects.toThrow(/FK_class_attendance_cancelled_by/);

      // Down goes back to P3-03's shape: the session is SCHEDULED again and keeps its records.
      await migration.down(runner);
      expect(await columns()).toEqual([]);
      expect((await runner.query(`SELECT status FROM class_attendance WHERE id = $1`, [session.id]))[0].status).toBe('SCHEDULED');
      expect(await runner.query(`SELECT id, status, source FROM class_attendance_records ORDER BY id`)).toEqual(recordsBefore);
      await migration.up(runner);
    } finally {
      await runner.release();
    }
  });
});
