import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { buildTypeOrmOptions } from './config/typeorm.config';

// The TypeORM CLI runs outside the Nest runtime, so load the .env file manually.
dotenv.config();

/**
 * DataSource with the full entity graph, used only by `migration:generate`
 * and `migration:check` (CI). Run it from the compiled `dist/` output: `nest build`
 * rewrites the `src/...` path aliases that plain ts-node cannot resolve.
 *
 * `data-source.ts` (no entities) stays the one used to run migrations.
 */
const dataSource = new DataSource({
  ...buildTypeOrmOptions(),
  // Migrations must never rely on schema auto-sync.
  synchronize: false,
  migrationsRun: false,
});

export default dataSource;
