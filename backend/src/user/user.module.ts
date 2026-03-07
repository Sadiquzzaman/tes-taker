import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { UserEntity } from './entities/user.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CryptoUtil } from 'src/common/utils/crypto.util';
import { JwtService } from '@nestjs/jwt';
import { UserFilterUtil } from 'src/common/utils/user-filter.util';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity])],
  controllers: [UserController],
  providers: [
    UserService,
    CryptoUtil,
    JwtService,
    UserFilterUtil,
  ],
  exports: [UserService],
})
export class UserModule {}
