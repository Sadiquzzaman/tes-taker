import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatMongoModule } from 'src/chat-mongo/chat-mongo.module';
import { ClassModule } from 'src/classes/class.module';
import { OrganizationsModule } from 'src/organizations/organization.module';
import { QueueModule } from 'src/queue/queue.module';
import { UploadController } from 'src/storage/upload.controller';
import { SubscriptionModule } from 'src/subscriptions/subscription.module';
import { FileObjectEntity } from './entities/file-object.entity';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { LegacyFilesService } from './legacy-files.service';

/**
 * Stored files (FND-15, FND-16, design §8.5): uploads, storage quota, the files.process job
 * (run by the worker) and the M4 move of old /uploads files (LegacyFilesService).
 */
@Module({
  imports: [TypeOrmModule.forFeature([FileObjectEntity]), QueueModule, SubscriptionModule, OrganizationsModule, ClassModule, ChatMongoModule],
  controllers: [FilesController, UploadController],
  providers: [FilesService, LegacyFilesService],
  exports: [FilesService, LegacyFilesService],
})
export class FilesModule {}
