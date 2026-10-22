import type { INestApplication } from '@nestjs/common';
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
} from '../../exams/dto/create-exam-wizard.dto';

export const SWAGGER_PATH = 'apidoc';

/** API docs are public, so they are never served in production (review #12). */
export function shouldServeSwagger(nodeEnv: string | undefined = process.env.NODE_ENV): boolean {
  return nodeEnv !== 'production';
}

/** Mounts Swagger at /apidoc unless NODE_ENV is production. Returns whether it was mounted. */
export function setupSwagger(app: INestApplication, nodeEnv: string | undefined = process.env.NODE_ENV): boolean {
  if (!shouldServeSwagger(nodeEnv)) {
    return false;
  }

  const config = new DocumentBuilder()
    .setTitle('Task Taker')
    .setDescription('Task Taker API DOC')
    .setVersion('1.0')
    .addTag('Instructor')
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
  SwaggerModule.setup(SWAGGER_PATH, app, document);
  return true;
}
