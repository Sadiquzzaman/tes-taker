import { SectionSchedules1756210000000 } from '../../src/migrations/1756210000000-SectionSchedules';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

/**
 * Migration P3-02 (section setup and schedules) on data shaped like beta before it: sections and no
 * setup. Up creates the two empty tables without touching sections, runs safely twice, keeps the
 * rules in the database, and reverts.
 */
describe('SectionSchedules migration', () => {
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

  it('creates section_attendance_settings and routine_slots, safely twice, and reverts', async () => {
    const owner = await make.teacher({ personal_teacher_enabled: false });
    const school = await make.organization(owner);
    await make.classOf(owner, { organization_id: school.id });
    const migration = new SectionSchedules1756210000000();
    const runner = t.dataSource.createQueryRunner();
    try {
      const exists = async (table: string) => (await runner.query(`SELECT to_regclass($1) IS NOT NULL AS e`, [`public.${table}`]))[0].e;
      const sectionsBefore = await runner.query(`SELECT id, name, branch_id, shift FROM sections ORDER BY id`);
      await migration.down(runner);
      expect(await exists('section_attendance_settings')).toBe(false);
      expect(await exists('routine_slots')).toBe(false);

      const log = jest.spyOn(console, 'log');
      await migration.up(runner);
      await migration.up(runner);
      expect(log).toHaveBeenCalledWith(
        `[SectionSchedules] sections: ${sectionsBefore.length}, section attendance settings: 0, routine slots: 0`,
      );
      expect(await runner.query(`SELECT id, name, branch_id, shift FROM sections ORDER BY id`)).toEqual(sectionsBefore);

      // The database keeps the rules: one settings row per section, grace 0–60, real days, start before end.
      const [section] = await runner.query(`SELECT id, session_id FROM sections WHERE organization_id = $1 LIMIT 1`, [school.id]);
      await runner.query(`INSERT INTO section_attendance_settings (organization_id, section_id) VALUES ($1, $2)`, [school.id, section.id]);
      const [row] = await runner.query(`SELECT class_type, mode, grace_minutes FROM section_attendance_settings WHERE section_id = $1`, [section.id]);
      expect(row).toEqual({ class_type: 'IN_PERSON', mode: 'SELF_CHECKIN', grace_minutes: null });
      await expect(
        runner.query(`INSERT INTO section_attendance_settings (organization_id, section_id) VALUES ($1, $2)`, [school.id, section.id]),
      ).rejects.toThrow(/UQ_section_attendance_settings_section/);
      await expect(runner.query(`UPDATE section_attendance_settings SET grace_minutes = 61 WHERE section_id = $1`, [section.id])).rejects.toThrow(
        /CHK_section_attendance_settings_grace/,
      );
      const slot = (day: number, start: string, end: string) =>
        runner.query(
          `INSERT INTO routine_slots (organization_id, session_id, section_id, day_of_week, start_time, end_time) VALUES ($1, $2, $3, $4, $5, $6)`,
          [school.id, section.session_id, section.id, day, start, end],
        );
      await slot(6, '16:00', '17:30');
      await expect(slot(8, '16:00', '17:30')).rejects.toThrow(/CHK_routine_slots_day/);
      await expect(slot(6, '17:30', '16:00')).rejects.toThrow(/CHK_routine_slots_times/);

      await migration.down(runner);
      expect(await exists('routine_slots')).toBe(false);
      await migration.up(runner);
    } finally {
      await runner.release();
    }
  });
});
