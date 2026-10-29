import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();
    const responseMessage =
      typeof exceptionResponse === 'object' ? (exceptionResponse as { message?: unknown }).message : undefined;
    const error_message = typeof responseMessage === 'string' ? responseMessage : exceptionResponse;

    // A machine-readable code the clients act on, e.g. FEATURE_NOT_IN_PLAN (design §8.3).
    const details = typeof exceptionResponse === 'object' ? (exceptionResponse as Record<string, unknown>) : {};
    const code = typeof details.code === 'string' ? details.code : undefined;

    response.status(status).json({
      statusCode: status,
      error: true,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: error_message,
      ...(code ? { code, feature: details.feature, limit: details.limit } : {}),
    });
  }
}
