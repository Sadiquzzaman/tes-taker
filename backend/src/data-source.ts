import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { buildTypeOrmOptions } from './config/typeorm.config';

// The TypeORM CLI runs outside the Nest runtime, so load the .env file manually.
dotenv.config();

/**
 * DataSource used exclusively by the TypeORM CLI for migrations
 * (generate / run / revert). The application itself is configured in
 * AppModule via `buildTypeOrmOptions`.
 *
 * Entities are omitted here on purpose: the CLI only needs the DB connection +
 * migration files. Loading `*.entity.ts` under plain ts-node fails because those
 * files import Nest path aliases like `src/...` which Node cannot resolve.
 * `migration:generate` and `migration:check` use `data-source.entities.ts` from the build.
 */
const appOptions = buildTypeOrmOptions();

const dataSource = new DataSource({
  ...appOptions,
  entities: [],
  // Migrations must never rely on schema auto-sync.
  synchronize: false,
  migrationsRun: false,
});

export default dataSource;
