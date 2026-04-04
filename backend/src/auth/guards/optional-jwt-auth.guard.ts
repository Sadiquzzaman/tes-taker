import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Runs JWT validation only when an Authorization: Bearer header is present.
 * Unauthenticated requests proceed with no user on the request.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{ headers?: { authorization?: string } }>();
    const auth = request.headers?.authorization;
    if (!auth?.startsWith('Bearer ')) {
      return true;
    }
    return super.canActivate(context) as Promise<boolean>;
  }

  handleRequest<TUser>(err: Error, user: TUser): TUser | undefined {
    if (err || !user) {
      return undefined;
    }
    return user;
  }
}
