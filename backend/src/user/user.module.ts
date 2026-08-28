import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { UserEntity } from './entities/user.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CryptoUtil } from 'src/common/utils/crypto.util';
import { JwtService } from '@nestjs/jwt';
import { UserFilterUtil } from 'src/common/utils/user-filter.util';
import { RefreshTokenUtil } from 'src/common/utils/refresh-token.util';
import { SubscriptionModule } from 'src/subscriptions/subscription.module';
import { OrganizationEntity } from 'src/organizations/entities/organization.entity';
import { OrganizationMemberEntity } from 'src/organizations/entities/organization-member.entity';
import { TestUsersSeedService } from './test-users.seed';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, OrganizationEntity, OrganizationMemberEntity]),
    SubscriptionModule,
  ],
  controllers: [UserController],
  providers: [
    UserService,
    TestUsersSeedService,
    CryptoUtil,
    JwtService,
    UserFilterUtil,
    RefreshTokenUtil,
  ],
  exports: [UserService],
})
export class UserModule {}
