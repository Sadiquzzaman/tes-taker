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

    response.status(status).json({
      statusCode: status,
      error: true,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: error_message,
    });
  }
}
