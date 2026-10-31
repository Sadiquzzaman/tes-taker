import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { LegacyFilesService } from './files/legacy-files.service';

/**
 * M4 (design §12): move files from the old /uploads storage into file_objects and rewrite their
 * links. Dry run by default; pass --apply to copy and rewrite. Re-runnable; never deletes old files.
 *
 *   pnpm files:migrate-legacy [--apply]            (development, ts-node)
 *   node dist/src/files-migrate-legacy.js [--apply] (inside the backend container)
 */
async function bootstrap() {
  // Like the worker: no boot-time seeding, so it never races the running API.
  process.env.APP_ROLE = 'worker';
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['log', 'warn', 'error'] });
  try {
    await app.get(LegacyFilesService).run({ apply: process.argv.includes('--apply') });
  } finally {
    await app.close();
  }
}
bootstrap().catch((error: unknown) => {
  Logger.error(error instanceof Error ? error.message : String(error), 'LegacyFiles');
  process.exit(1);
});
