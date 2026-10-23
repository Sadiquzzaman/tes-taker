import './load-env';
import Redis from 'ioredis';
import mongoose from 'mongoose';
import { DataSource } from 'typeorm';
import { buildTypeOrmOptions } from '../../src/config/typeorm.config';

/**
 * Runs once before the API tests: rebuilds the test database from the real migrations
 * (as CI and beta do) and empties the test Redis and MongoDB.
 */
export default async function globalSetup(): Promise<void> {
  const dataSource = new DataSource({
    ...buildTypeOrmOptions(),
    // Raw SQL and migrations only; loading entities is not needed (and their src/ imports need Jest's mapper).
    entities: [],
    synchronize: false,
    migrationsRun: false,
    logging: false,
  });
  await dataSource.initialize();
  await dataSource.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await dataSource.runMigrations();
  await dataSource.destroy();

  const redis = new Redis({ host: process.env.REDIS_HOST, port: Number(process.env.REDIS_PORT), lazyConnect: true });
  await redis.connect();
  await redis.flushdb();
  redis.disconnect();

  const mongo = await mongoose.createConnection(process.env.MONGODB_URI as string).asPromise();
  await mongo.dropDatabase();
  await mongo.close();
}
