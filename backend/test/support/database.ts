import { DataSource } from 'typeorm';
import { buildTypeOrmOptions } from '../../src/config/typeorm.config';

/** Tables kept between test files: migration history and the plan catalogue the app seeds on boot. */
const KEEP = new Set(['migrations', 'subscription_plans']);

/** Empties every other table, so each test file starts from a clean database. */
export async function resetDatabase(): Promise<void> {
  const dataSource = new DataSource({
    ...buildTypeOrmOptions(),
    // Raw SQL and migrations only; loading entities is not needed (and their src/ imports need Jest's mapper).
    entities: [],
    synchronize: false,
    migrationsRun: false,
    logging: false,
  });
  await dataSource.initialize();
  try {
    const rows: Array<{ tablename: string }> = await dataSource.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public'",
    );
    const tables = rows.map((r) => r.tablename).filter((name) => !KEEP.has(name));
    if (tables.length > 0) {
      await dataSource.query(`TRUNCATE ${tables.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`);
    }
  } finally {
    await dataSource.destroy();
  }
}
