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
 */
const dataSource = new DataSource({
  ...buildTypeOrmOptions(),
  // Migrations must never rely on schema auto-sync.
  synchronize: false,
  migrationsRun: false,
});

export default dataSource;
