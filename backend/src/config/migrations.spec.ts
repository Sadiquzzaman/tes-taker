import { QueryRunner } from 'typeorm';
import {
  BASELINE_TABLES,
  BaselineSchema1753000000000,
} from 'src/migrations/1753000000000-BaselineSchema';
import { ReconcileSchema1754900000000 } from 'src/migrations/1754900000000-ReconcileSchema';

// Lives outside src/migrations: the migration glob would load a spec file there as a migration.

function fakeRunner(existingTables: string[]) {
  const query = jest.fn().mockResolvedValue(undefined);
  const hasTable = jest.fn(async (table: string) => existingTables.includes(table));
  return { runner: { query, hasTable } as unknown as QueryRunner, query };
}

describe('BaselineSchema1753000000000', () => {
  const migration = new BaselineSchema1753000000000();

  it('creates the schema on an empty database', async () => {
    const { runner, query } = fakeRunner([]);
    await migration.up(runner);

    const sql = query.mock.calls.map(([statement]) => statement as string);
    expect(sql[0]).toContain('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    for (const table of BASELINE_TABLES) {
      expect(sql.some((statement) => statement.includes(`CREATE TABLE "${table}"`))).toBe(true);
    }
  });

  it('changes nothing when every baseline table exists (beta, synchronize-built dev databases)', async () => {
    const { runner, query } = fakeRunner([...BASELINE_TABLES]);
    await migration.up(runner);
    expect(query).not.toHaveBeenCalled();
  });

  it('stops on a partial schema and names the missing tables', async () => {
    const { runner, query } = fakeRunner(['users', 'organizations']);
    await expect(migration.up(runner)).rejects.toThrow(/2 of \d+ baseline tables \(missing: .*subjects/);
    expect(query).not.toHaveBeenCalled();
  });

  it('refuses to be reverted', async () => {
    await expect(migration.down()).rejects.toThrow(/cannot be reverted/);
  });

  it('covers every table the entities declare (27 + the migrations table = 28 on beta)', () => {
    expect(BASELINE_TABLES).toHaveLength(27);
    expect(new Set(BASELINE_TABLES).size).toBe(BASELINE_TABLES.length);
  });
});

describe('ReconcileSchema1754900000000', () => {
  const migration = new ReconcileSchema1754900000000();

  async function upSql() {
    const { runner, query } = fakeRunner([]);
    await migration.up(runner);
    return query.mock.calls.map(([statement]) => (statement as string).replace(/\s+/g, ' ').trim());
  }

  it('restores one pending teacher-role request per user, after checking existing rows', async () => {
    const sql = await upSql();
    const check = sql.findIndex((s) => s.includes('more than one pending teacher request'));
    const create = sql.findIndex((s) =>
      s.includes(
        'CREATE UNIQUE INDEX IF NOT EXISTS "UQ_teacher_role_requests_pending_user" ON "teacher_role_requests" ("user_id") WHERE "status" = \'pending\'',
      ),
    );
    expect(check).toBeGreaterThanOrEqual(0);
    expect(create).toBeGreaterThan(check);
  });

  it('makes organization subject uniqueness case-insensitive, after checking existing rows', async () => {
    const sql = await upSql();
    const check = sql.findIndex((s) => s.includes('differ only by case'));
    const create = sql.findIndex((s) =>
      s.includes(
        'CREATE UNIQUE INDEX "UQ_subjects_org_name_code" ON "subjects" ("organization_id", LOWER("name"), LOWER("code")) WHERE "organization_id" IS NOT NULL',
      ),
    );
    expect(check).toBeGreaterThanOrEqual(0);
    expect(create).toBeGreaterThan(check);
  });

  it('only drops objects with IF EXISTS, so it is safe where they are already gone', async () => {
    const sql = await upSql();
    const drops = sql.filter((s) => /\bDROP (INDEX|CONSTRAINT)\b/.test(s));
    expect(drops.length).toBeGreaterThan(0);
    for (const statement of drops) expect(statement).toContain('IF EXISTS');
  });

  it('never drops the entity-named (hashed) objects or any table', async () => {
    const sql = await upSql();
    expect(sql.some((s) => /DROP (INDEX|CONSTRAINT) IF EXISTS "(IDX|FK|UQ)_[0-9a-f]{20,}"/.test(s))).toBe(false);
    expect(sql.some((s) => /DROP TABLE|DROP COLUMN|DROP SEQUENCE/.test(s))).toBe(false);
  });
});
