import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { setupSwagger } from './common/swagger/swagger.setup';
import { configureApp } from './app.setup';
import { mountBullBoard } from './queue/bull-board';
import helmet from 'helmet';
import { resolve } from 'path';
import { existsSync, mkdirSync } from 'fs';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // When deployed behind a reverse proxy (NGINX/Hetzner load balancer), trust
  // the X-Forwarded-* headers so req.ip reflects the real client. This keeps
  // rate limiting and secure-cookie handling accurate. Enable via TRUST_PROXY.
  if (process.env.TRUST_PROXY === 'true') {
    app.set('trust proxy', 1);
  }

  const uploadsRoot = resolve(process.env.STORAGE_LOCAL_PATH || './uploads');
  // Local driver only — S3 objects are served from the bucket URL directly.
  if ((process.env.STORAGE_DRIVER || 'local').toLowerCase() !== 's3') {
    if (!existsSync(uploadsRoot)) {
      mkdirSync(uploadsRoot, { recursive: true });
    }
    app.useStaticAssets(uploadsRoot, { prefix: '/uploads/' });
  }

  // Security headers. The CSP allow-list is intentionally compatible with the
  // browser features this platform relies on: Google OAuth, Socket.IO, the
  // Swagger UI assets, SSLCommerz, and the client-side ML libraries
  // (TensorFlow.js, MediaPipe) that may load from jsDelivr and use wasm/eval.
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            "'unsafe-inline'",
            "'unsafe-eval'",
            'https://cdn.jsdelivr.net',
            'https://accounts.google.com',
            'https://securepay.sslcommerz.com',
            'https://sandbox.sslcommerz.com',
          ],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://fonts.googleapis.com'],
          imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
          connectSrc: ["'self'", 'https:', 'wss:', 'ws:'],
          fontSrc: ["'self'", 'data:', 'https://cdn.jsdelivr.net', 'https://fonts.gstatic.com'],
          workerSrc: ["'self'", 'blob:'],
          frameSrc: [
            "'self'",
            'https://accounts.google.com',
            'https://securepay.sslcommerz.com',
            'https://sandbox.sslcommerz.com',
          ],
          objectSrc: ["'none'"],
        },
      },
      // The frontend consumes this API cross-origin; allow that while keeping
      // other protections. COEP is disabled to avoid breaking third-party embeds.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      crossOriginEmbedderPolicy: false,
    }),
  );

  const clientOrigin = process.env.CLIENT_ORIGIN;
  app.enableCors(
    clientOrigin
      ? { origin: clientOrigin.split(',').map((o) => o.trim()), credentials: true }
      : undefined,
  );
  configureApp(app);

  // Swagger UI at /apidoc, only outside production.
  setupSwagger(app);

  // Queue dashboard for admins (basic auth); off unless BULL_BOARD_USER/PASSWORD are set.
  mountBullBoard(app);

  // Listen for SIGTERM/SIGINT and run onModuleDestroy / onApplicationShutdown
  // hooks so PostgreSQL, Redis, Socket.IO and the HTTP server close cleanly.
  app.enableShutdownHooks();

  const port = process.env.APP_PORT || 3000;
  await app.listen(port);
  Logger.log(`Application is running on port ${port}`, 'Bootstrap');
}
bootstrap();
