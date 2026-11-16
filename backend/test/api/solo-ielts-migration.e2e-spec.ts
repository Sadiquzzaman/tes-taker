import { SoloIelts1756530000000 } from '../../src/migrations/1756530000000-SoloIelts';
import { createTestApp, TestApp } from '../support/test-app';

/** Solo IELTS trainers (P12-03): the request column is made safely twice, defaults to ACADEMIC, and is reverted. */
describe('SoloIelts migration', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterAll(async () => {
    await t.close();
  });

  it('adds teacher_role_requests.workspace_type, safely twice, and reverts', async () => {
    const migration = new SoloIelts1756530000000();
    const runner = t.dataSource.createQueryRunner();
    const column = async () =>
      (await runner.query(`SELECT column_default FROM information_schema.columns WHERE table_name = 'teacher_role_requests' AND column_name = 'workspace_type'`))[0];
    try {
      await migration.down(runner);
      expect(await column()).toBeUndefined();
      const log = jest.spyOn(console, 'log');
      await migration.up(runner);
      await migration.up(runner);
      expect((await column()).column_default).toContain('ACADEMIC');
      expect(log).toHaveBeenCalledWith('[SoloIelts] IELTS teacher requests: 0');
    } finally {
      await runner.release();
    }
  });
});
