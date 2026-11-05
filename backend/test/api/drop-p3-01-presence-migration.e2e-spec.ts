import { DropP301PresenceSettings1756220000000 } from '../../src/migrations/1756220000000-DropP301PresenceSettings';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

const DROPPED = ['attendance_method', 'selfie_required', 'class_attendance_mode', 'student_entry_time', 'teacher_entry_time'];

/**
 * Contract step of P3-02 on data shaped like beta before it: org_settings rows with P3-01's presence
 * columns at their defaults. Up drops the five columns and their two types, keeps every other
 * setting, logs a count check and runs safely twice; down adds the columns back with their defaults.
 */
describe('DropP301PresenceSettings migration', () => {
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

  it('drops the presence columns and types, keeps the other settings, safely twice, and reverts', async () => {
    const owner = await make.teacher({ personal_teacher_enabled: false });
    const school = await make.organization(owner);
    const migration = new DropP301PresenceSettings1756220000000();
    const runner = t.dataSource.createQueryRunner();
    const columns = async () =>
      (
        await runner.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'org_settings' AND column_name = ANY($1)`, [
          DROPPED,
        ])
      ).length;
    const types = async () =>
      (await runner.query(`SELECT typname FROM pg_type WHERE typname IN ('attendance_method', 'class_attendance_mode')`)).length;
    try {
      // Before: the columns as P3-01 left them, on a row with other settings.
      await migration.down(runner);
      expect(await columns()).toBe(5);
      await runner.query(
        `INSERT INTO org_settings (organization_id, class_teacher_enabled, weekly_off_days, late_grace_minutes, repeat_absence_days, created_at)
         VALUES ($1, true, '{5,6}', 15, 4, now())
         ON CONFLICT (organization_id) DO UPDATE SET weekly_off_days = '{5,6}', late_grace_minutes = 15, repeat_absence_days = 4`,
        [school.id],
      );

      const log = jest.spyOn(console, 'log');
      await migration.up(runner);
      expect(log).toHaveBeenCalledWith(expect.stringMatching(/\[DropP301PresenceSettings\] org_settings rows: \d+, columns dropped: 5, rows with non-default values: 0/));
      await migration.up(runner);
      expect(log).toHaveBeenCalledWith(expect.stringMatching(/columns dropped: 0, rows with non-default values: 0/));
      expect(await columns()).toBe(0);
      expect(await types()).toBe(0);
      const [row] = await runner.query(
        `SELECT weekly_off_days, late_grace_minutes, repeat_absence_days, guardian_sms FROM org_settings WHERE organization_id = $1`,
        [school.id],
      );
      expect(row).toEqual({ weekly_off_days: [5, 6], late_grace_minutes: 15, repeat_absence_days: 4, guardian_sms: { late: true, absent: true, leave: true } });

      await migration.down(runner);
      const [restored] = await runner.query(`SELECT ${DROPPED.join(', ')} FROM org_settings WHERE organization_id = $1`, [school.id]);
      expect(restored).toEqual({
        attendance_method: 'OFF',
        selfie_required: false,
        class_attendance_mode: 'PER_SESSION',
        student_entry_time: '09:00:00',
        teacher_entry_time: '08:45:00',
      });
    } finally {
      await migration.up(runner);
      await runner.release();
    }
  });
});
