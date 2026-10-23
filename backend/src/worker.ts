import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker/worker.module';

/**
 * Background worker (design §3): the same codebase as main.ts, without the HTTP server.
 * It runs the BullMQ processors and schedules (design §7). Boot-time seeding stays in the
 * API process (APP_ROLE=worker), so API and worker starting together never race on it.
 */
async function bootstrap() {
  process.env.APP_ROLE = 'worker';
  const app = await NestFactory.createApplicationContext(WorkerModule);
  app.enableShutdownHooks();
  Logger.log('Worker ready', 'Worker');
}
bootstrap();
