import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import {
  CreateExamWizardDto,
  WizardAnswerDto,
  WizardChildQuestionDto,
  WizardFormStateDto,
  WizardGradedQuestionDto,
  WizardMatchingOptionsDto,
  WizardMatchingSideOptionDto,
  WizardOptionDto,
  WizardPassageQuestionDto,
  WizardPublishStateDto,
  WizardSubjectBlockDto,
  WizardUngradedQuestionDto,
} from './exams/dto/create-exam-wizard.dto';
import { WrapResponseInterceptor } from './common/interceptors/wrap-response.interceptor';
import { HttpExceptionFilter } from './common/exceptions/http-exception.filter';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

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
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Task Taker')
    .setDescription('Task Taker API DOC')
    .setVersion('1.0')
    .addTag('TaskTaker')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'jwt',
    )
    .build();
  const document = SwaggerModule.createDocument(app, config, {
    extraModels: [
      CreateExamWizardDto,
      WizardFormStateDto,
      WizardPublishStateDto,
      WizardSubjectBlockDto,
      WizardGradedQuestionDto,
      WizardUngradedQuestionDto,
      WizardPassageQuestionDto,
      WizardChildQuestionDto,
      WizardOptionDto,
      WizardMatchingSideOptionDto,
      WizardMatchingOptionsDto,
      WizardAnswerDto,
    ],
  });
  SwaggerModule.setup('apidoc', app, document);

  //use custom made global handlers to use in app
  app.useGlobalInterceptors(new WrapResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  // Listen for SIGTERM/SIGINT and run onModuleDestroy / onApplicationShutdown
  // hooks so PostgreSQL, Redis, Socket.IO and the HTTP server close cleanly.
  app.enableShutdownHooks();

  const port = process.env.APP_PORT || 3000;
  await app.listen(port);
  Logger.log(`Application is running on port ${port}`, 'Bootstrap');
}
bootstrap();
