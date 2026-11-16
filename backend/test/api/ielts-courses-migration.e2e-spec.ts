import { IeltsCourses1756550000000 } from '../../src/migrations/1756550000000-IeltsCourses';
import { OrganizationKindEnum } from '../../src/organizations/enums/organization-kind.enum';
import { WorkspaceTypeEnum } from '../../src/organizations/enums/workspace-type.enum';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

/** IELTS courses (P12-04): the table and columns made safely twice; IELTS batches become courses; reverted. */
describe('IeltsCourses migration', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterAll(async () => {
    await t.close();
  });

  it('makes a course of each IELTS batch, leaves schools alone, safely twice, and reverts', async () => {
    const make = factories(t.dataSource);
    const centreOwner = await make.teacher({ personal_teacher_enabled: false });
    const centre = await make.organization(centreOwner, { kind: OrganizationKindEnum.IELTS_CENTRE, workspace_type: WorkspaceTypeEnum.IELTS });
    const batch = await make.classOf(centreOwner, { organization_id: centre.id, class_name: 'Band 7 Academic' });
    const schoolOwner = await make.teacher({ personal_teacher_enabled: false });
    const school = await make.organization(schoolOwner);
    await make.classOf(schoolOwner, { organization_id: school.id });

    const migration = new IeltsCourses1756550000000();
    const runner = t.dataSource.createQueryRunner();
    try {
      await migration.down(runner);
      expect((await runner.query(`SELECT to_regclass('public.ielts_courses') IS NOT NULL AS e`))[0].e).toBe(false);
      const log = jest.spyOn(console, 'log');
      await migration.up(runner);
      await migration.up(runner);
      const courses = await runner.query(
        `SELECT c.title, c.modules, c.organization_id, c.class_id, b.is_default FROM ielts_courses c LEFT JOIN branches b ON b.id = c.branch_id WHERE c.organization_id = ANY($1)`,
        [[centre.id, school.id]],
      );
      expect(courses).toEqual([
        { title: 'Band 7 Academic', modules: ['LISTENING', 'READING', 'WRITING', 'SPEAKING'], organization_id: centre.id, class_id: batch.id, is_default: null },
      ]);
      const [counts] = await runner.query(`SELECT count(*)::int AS n FROM ielts_courses`);
      expect(log).toHaveBeenCalledWith(`[IeltsCourses] courses: ${counts.n}`);
    } finally {
      await runner.release();
    }
  });
});
