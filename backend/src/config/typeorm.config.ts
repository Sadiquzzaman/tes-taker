import { join } from 'path';
import { DataSourceOptions } from 'typeorm';

/**
 * Single source of truth for the TypeORM connection.
 *
 * Both the NestJS runtime (AppModule) and the TypeORM CLI (data-source.ts,
 * used for migrations) build their options from this helper so the two can
 * never drift apart.
 *
 * Reads plain `process.env` on purpose: ConfigModule loads the `.env` file into
 * `process.env`, and the CLI runs without the Nest DI container.
 */
const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined || value === '') {
    return fallback;
  }
  return value.toLowerCase() === 'true';
};

export const buildTypeOrmOptions = (): DataSourceOptions => {
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    type: 'postgres',
    host: process.env.DATABASE_HOST ?? 'localhost',
    port: Number(process.env.DATABASE_PORT ?? 5432),
    username: process.env.DATABASE_USER ?? 'postgres',
    password: String(process.env.DATABASE_PASSWORD ?? ''),
    database: process.env.DATABASE_DB ?? 'tasktaker',
    entities: [join(__dirname, '..', '**', '*.entity{.ts,.js}')],
    migrations: [join(__dirname, '..', 'migrations', '*{.ts,.js}')],
    // Production must never auto-alter the schema. Development keeps the
    // convenient default (true) unless explicitly overridden.
    synchronize: parseBoolean(process.env.DATABASE_SYNCRONIZE, !isProduction),
    // Optionally run pending migrations automatically on boot. Handy for a
    // single-server Hetzner deployment; keep false when running migrations
    // as a separate step.
    migrationsRun: parseBoolean(process.env.DATABASE_MIGRATIONS_RUN, false),
    logging: parseBoolean(process.env.DATABASE_LOGGING, false),
  };
};
