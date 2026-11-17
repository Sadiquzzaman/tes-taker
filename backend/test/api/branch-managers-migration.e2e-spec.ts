import { BranchManagers1756520000000 } from '../../src/migrations/1756520000000-BranchManagers';
import { OrganizationMemberRoleEnum } from '../../src/organizations/enums/organization-member-role.enum';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

/** Branches on/off and branch managers (P12-01): columns made safely twice, branches switched on where used, reverted. */
describe('BranchManagers migration', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterAll(async () => {
    await t.close();
  });

  it('adds the columns, switches branches on where an organisation has one, and reverts', async () => {
    const make = factories(t.dataSource);
    const withBranch = await make.organization(await make.teacher());
    const without = await make.organization(await make.teacher());
    const migration = new BranchManagers1756520000000();
    const runner = t.dataSource.createQueryRunner();
    const column = async (table: string, name: string) =>
      (await runner.query(`SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`, [table, name])).length > 0;
    try {
      await migration.down(runner);
      expect(await column('org_settings', 'branches_enabled')).toBe(false);
      expect(await column('organization_members', 'branch_id')).toBe(false);

      for (const organization of [withBranch, without]) {
        await runner.query(`INSERT INTO org_settings (organization_id, class_teacher_enabled, created_at) VALUES ($1, true, now()) ON CONFLICT (organization_id) DO NOTHING`, [organization.id]);
      }
      await runner.query(`INSERT INTO branches (organization_id, name, is_default, checkin_radius_m) VALUES ($1, 'Farmgate', false, 100)`, [withBranch.id]);

      const log = jest.spyOn(console, 'log');
      await migration.up(runner);
      await migration.up(runner);
      const [counts] = await runner.query(`SELECT (SELECT count(*) FROM org_settings WHERE branches_enabled)::int AS on`);
      expect(log).toHaveBeenCalledWith(`[BranchManagers] organisations with branches: ${counts.on}, branch managers: 0`);
      const settings = await runner.query(`SELECT organization_id, branches_enabled FROM org_settings WHERE organization_id = ANY($1)`, [[withBranch.id, without.id]]);
      expect(Object.fromEntries(settings.map((row: { organization_id: string; branches_enabled: boolean }) => [row.organization_id, row.branches_enabled]))).toEqual({
        [withBranch.id]: true,
        [without.id]: false,
      });
      const roles = await runner.query(`SELECT unnest(enum_range(NULL::organization_members_role_enum))::text AS role`);
      expect(roles.map((r: { role: string }) => r.role)).toContain(OrganizationMemberRoleEnum.BRANCH_MANAGER);
    } finally {
      await runner.release();
    }
  });
});
