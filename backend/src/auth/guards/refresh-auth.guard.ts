import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class RefreshAuthGuard extends AuthGuard('refresh') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }
}
