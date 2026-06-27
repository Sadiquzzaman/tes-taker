import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

//global response interceptor interface
export interface Response<T> {
  statusCode: number;
  message: string;
  data: T;
  error: boolean;
}

@Injectable()
export class WrapResponseInterceptor<T>
  implements NestInterceptor<T, Response<T>>
{
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
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
