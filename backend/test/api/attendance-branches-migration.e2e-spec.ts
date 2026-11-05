import { AttendanceBranches1756200000000 } from '../../src/migrations/1756200000000-AttendanceBranches';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

/**
 * Migration P3-02 (branches) on data shaped like beta before it: organisations with sections and an
 * org_settings row. Up gives every organisation one main branch and leaves sections on it (null),
 * adds the grace period with its default, changes no other data, runs safely twice and reverts.
 */
describe('AttendanceBranches migration', () => {
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

  it('adds branches with one main branch per organisation, sections.branch_id and the grace period, safely twice, and reverts', async () => {
    const owner = await make.teacher({ personal_teacher_enabled: false });
    const school = await make.organization(owner);
    const teacher = await make.teacher();
    const solo = await make.soloOrganization(teacher);
    const schoolClass = await make.classOf(owner, { organization_id: school.id });
    const migration = new AttendanceBranches1756200000000();
    const runner = t.dataSource.createQueryRunner();
    try {
      await migration.down(runner);
      const exists = async (table: string, column?: string) =>
        column
          ? (await runner.query(`SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`, [table, column])).length > 0
          : (await runner.query(`SELECT to_regclass($1) IS NOT NULL AS e`, [`public.${table}`]))[0].e;
      expect(await exists('branches')).toBe(false);
      expect(await exists('sections', 'branch_id')).toBe(false);
      expect(await exists('org_settings', 'late_grace_minutes')).toBe(false);

      // Data from before P3-02: a section and a settings row with P3-01's columns.
      const [session] = await runner.query(`SELECT id FROM academic_sessions WHERE organization_id = $1 LIMIT 1`, [school.id]);
      await runner.query(
        `INSERT INTO sections (organization_id, class_id, session_id, name, created_at) VALUES ($1, $2, $3, 'B', now())`,
        [school.id, schoolClass.id, session.id],
      );
      await runner.query(
        `INSERT INTO org_settings (organization_id, class_teacher_enabled, weekly_off_days, created_at)
         VALUES ($1, true, '{5,6}', now()) ON CONFLICT (organization_id) DO UPDATE SET weekly_off_days = '{5,6}'`,
        [school.id],
      );
      const sectionsBefore = await runner.query(`SELECT id, name, class_id, session_id FROM sections WHERE organization_id = $1 ORDER BY name`, [school.id]);

      const log = jest.spyOn(console, 'log');
      await migration.up(runner);
      await migration.up(runner);
      const [counts] = await runner.query(
        `SELECT (SELECT count(*)::int FROM organizations) AS o, (SELECT count(*)::int FROM sections) AS s`,
      );
      expect(log).toHaveBeenCalledWith(
        `[AttendanceBranches] organisations: ${counts.o}, default branches: ${counts.o}, sections: ${counts.s} (on the default branch: ${counts.s})`,
      );

      const branches = await runner.query(
        `SELECT organization_id, name, geo_lat, geo_lng, checkin_radius_m, is_default, is_active FROM branches WHERE organization_id = ANY($1)`,
        [[school.id, solo.id]],
      );
      expect(branches).toHaveLength(2);
      for (const branch of branches) {
        expect(branch).toMatchObject({ name: null, geo_lat: null, geo_lng: null, checkin_radius_m: 100, is_default: true, is_active: '1' });
      }
      const sectionsAfter = await runner.query(
        `SELECT id, name, class_id, session_id, branch_id FROM sections WHERE organization_id = $1 ORDER BY name`,
        [school.id],
      );
      expect(sectionsAfter).toEqual(sectionsBefore.map((section: object) => ({ ...section, branch_id: null })));
      const [settings] = await runner.query(
        `SELECT late_grace_minutes, weekly_off_days, attendance_method FROM org_settings WHERE organization_id = $1`,
        [school.id],
      );
      expect(settings).toEqual({ late_grace_minutes: 10, weekly_off_days: [5, 6], attendance_method: 'OFF' });

      // The database keeps the rules: one main branch, a radius of 25–1000 m, a whole pin, a name for other branches, grace 0–60.
      await expect(runner.query(`INSERT INTO branches (organization_id, is_default) VALUES ($1, true)`, [school.id])).rejects.toThrow(
        /UQ_branches_default/,
      );
      await expect(runner.query(`INSERT INTO branches (organization_id, name, checkin_radius_m) VALUES ($1, 'X', 10)`, [school.id])).rejects.toThrow(
        /CHK_branches_radius/,
      );
      await expect(runner.query(`INSERT INTO branches (organization_id, name, geo_lat) VALUES ($1, 'X', 23.7)`, [school.id])).rejects.toThrow(
        /CHK_branches_pin/,
      );
      await expect(runner.query(`INSERT INTO branches (organization_id) VALUES ($1)`, [school.id])).rejects.toThrow(/CHK_branches_name/);
      await expect(runner.query(`UPDATE org_settings SET late_grace_minutes = 61 WHERE organization_id = $1`, [school.id])).rejects.toThrow(
        /CHK_org_settings_late_grace_minutes/,
      );
    } finally {
      await runner.release();
    }
  });
});
