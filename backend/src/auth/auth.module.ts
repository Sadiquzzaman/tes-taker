import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { GoogleAuthService } from './google-auth.service';
import { UserModule } from 'src/user/user.module';
import { SmsModule } from 'src/sms/sms.module';
import { EmailModule } from 'src/email/email.module';
import { ClassModule } from 'src/classes/class.module';
import { SubscriptionModule } from 'src/subscriptions/subscription.module';
import { OrganizationsModule } from 'src/organizations/organization.module';
import { TeacherRequestModule } from 'src/teacher-requests/teacher-request.module';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RefreshTokenStrategy } from './strategies/refresh-token.strategy';

@Module({
  imports: [
    UserModule,
    SmsModule,
    EmailModule,
    ClassModule,
    SubscriptionModule,
    OrganizationsModule,
    TeacherRequestModule,
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '30m' },
    }),
    PassportModule.register({
      defaultStrategy: 'refresh',
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, GoogleAuthService, JwtStrategy, RefreshTokenStrategy],
})
export class AuthModule {}
