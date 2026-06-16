import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ValidationPipe, VersioningType } from '@nestjs/common';
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

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
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
  
  await app.listen(process.env.APP_PORT || 3000);
}
bootstrap();
