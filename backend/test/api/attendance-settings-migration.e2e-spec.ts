import { AttendanceSettingsHolidays1756100000000 } from '../../src/migrations/1756100000000-AttendanceSettingsHolidays';
import { DropP301PresenceSettings1756220000000 } from '../../src/migrations/1756220000000-DropP301PresenceSettings';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

/**
 * Migration P3-01 on data shaped like beta before it: organisations with and without an
 * org_settings row. Down removes the columns and `holidays`; up adds them with the spec's defaults
 * for existing rows, and a second run changes nothing.
 */
describe('AttendanceSettingsHolidays migration', () => {
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

  it('adds the attendance settings with defaults to existing rows and creates holidays, safely twice, and reverts', async () => {
    const owner = await make.teacher({ personal_teacher_enabled: false });
    const school = await make.organization(owner);
    const migration = new AttendanceSettingsHolidays1756100000000();
    const runner = t.dataSource.createQueryRunner();
    try {
      await migration.down(runner);
      const columns = async () =>
        (
          await runner.query(
            `SELECT column_name FROM information_schema.columns WHERE table_name = 'org_settings' AND column_name = ANY($1)`,
            [['attendance_method', 'weekly_off_days', 'guardian_sms', 'repeat_absence_days']],
          )
        ).length;
      const holidaysExists = async () => (await runner.query(`SELECT to_regclass('public.holidays') IS NOT NULL AS e`))[0].e;
      expect(await columns()).toBe(0);
      expect(await holidaysExists()).toBe(false);

      // A settings row from before P3-01 (as P2-03/P2-04 wrote them).
      await runner.query(
        `INSERT INTO org_settings (organization_id, class_teacher_enabled, created_at, is_active) VALUES ($1, true, now(), '1')`,
        [school.id],
      );

      const log = jest.spyOn(console, 'log');
      await migration.up(runner);
      await migration.up(runner);
      expect(log).toHaveBeenCalledWith(expect.stringContaining('[AttendanceSettingsHolidays] org_settings rows: 1, daily presence off: 1, holidays: 0'));

      expect(await columns()).toBe(4);
      expect(await holidaysExists()).toBe(true);
      const [row] = await runner.query(
        `SELECT attendance_method, selfie_required, class_attendance_mode, weekly_off_days, student_entry_time, teacher_entry_time,
                guardian_sms, repeat_absence_days, class_teacher_enabled
         FROM org_settings WHERE organization_id = $1`,
        [school.id],
      );
      expect(row).toEqual({
        attendance_method: 'OFF',
        selfie_required: false,
        class_attendance_mode: 'PER_SESSION',
        weekly_off_days: [5],
        student_entry_time: '09:00:00',
        teacher_entry_time: '08:45:00',
        guardian_sms: { late: true, absent: true, leave: true },
        repeat_absence_days: 3,
        class_teacher_enabled: true,
      });

      // The database refuses a reversed range and out-of-range alert days.
      await expect(
        runner.query(`INSERT INTO holidays (organization_id, date_from, date_to) VALUES ($1, '2026-12-17', '2026-12-16')`, [school.id]),
      ).rejects.toThrow(/CHK_holidays_date_range/);
      await expect(runner.query(`UPDATE org_settings SET repeat_absence_days = 1 WHERE organization_id = $1`, [school.id])).rejects.toThrow(
        /CHK_org_settings_repeat_absence_days/,
      );
    } finally {
      // P3-02 dropped P3-01's presence columns again; end with the current schema.
      await new DropP301PresenceSettings1756220000000().up(runner);
      await runner.release();
    }
  });
});
