import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from 'src/user/user.module';
import { TeacherRoleRequestEntity } from './entities/teacher-role-request.entity';
import { TeacherRequestController } from './teacher-request.controller';
import { TeacherRequestService } from './teacher-request.service';

@Module({
  imports: [TypeOrmModule.forFeature([TeacherRoleRequestEntity]), UserModule],
  controllers: [TeacherRequestController],
  providers: [TeacherRequestService],
  exports: [TeacherRequestService],
})
export class TeacherRequestModule {}
