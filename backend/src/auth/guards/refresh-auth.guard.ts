import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class RefreshAuthGuard extends AuthGuard('refresh') {
  async canActivate(context: ExecutionContext): Promise<any> {
    return super.canActivate(context);
  }
}
