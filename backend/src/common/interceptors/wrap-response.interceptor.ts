import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/** What controllers return: `{ message, payload, meta? }`, or nothing when they send the response themselves. */
type HandlerResult = { message?: string; payload?: unknown; meta?: unknown } | null | undefined;

/** The envelope every JSON response is wrapped in. */
export interface WrappedResponse {
  statusCode: number;
  message: string;
  payload: unknown;
  meta?: unknown;
  error: false;
}

@Injectable()
export class WrapResponseInterceptor implements NestInterceptor<HandlerResult, WrappedResponse | HandlerResult> {
  intercept(context: ExecutionContext, next: CallHandler<HandlerResult>): Observable<WrappedResponse | HandlerResult> {
    return next.handle().pipe(
      map((data) => {
        const response = context.switchToHttp().getResponse();
        // Handlers that manage the response themselves (e.g. @Res() redirects)
        // emit no data and have already sent headers; leave them untouched.
        if (response.headersSent || data === undefined || data === null) {
          return data;
        }
        return {
          statusCode: response.statusCode,
          message: data.message ?? 'successfull',
          payload: data.payload,
          meta: data.meta ?? undefined,
          error: false,
        };
      }),
    );
  }
}
