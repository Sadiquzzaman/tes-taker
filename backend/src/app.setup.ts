import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { HttpExceptionFilter } from './common/exceptions/http-exception.filter';
import { WrapResponseInterceptor } from './common/interceptors/wrap-response.interceptor';

/**
 * The request pipeline every API call goes through: /api prefix, URI versioning,
 * validation, the response envelope and the error filter. Used by main.ts and by the
 * API tests, so tests exercise the same pipeline as the running app.
 */
export function configureApp(app: INestApplication): void {
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

  //use custom made global handlers to use in app
  app.useGlobalInterceptors(new WrapResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());
}
