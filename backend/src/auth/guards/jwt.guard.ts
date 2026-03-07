import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
// import { Request } from 'express';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<any> {
    // const request = context.switchToHttp().getRequest<Request>();
    // console.log(request);
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any) {
    if (err || !user) {
      throw err || new UnauthorizedException();
    }
    return user;
  }
}
