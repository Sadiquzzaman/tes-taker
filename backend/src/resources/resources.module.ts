import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicsModule } from 'src/academics/academics.module';
import { OrganizationsModule } from 'src/organizations/organization.module';
import { SubscriptionModule } from 'src/subscriptions/subscription.module';
import { ResourceFolderEntity } from './entities/resource-folder.entity';
import { ResourceShareEntity } from './entities/resource-share.entity';
import { ResourceViewEntity } from './entities/resource-view.entity';
import { ResourceEntity } from './entities/resource.entity';
import { ResourcesController } from './resources.controller';
import { ResourcesService } from './resources.service';

/**
 * The resource library (Epic 8, design §4): owns resource_folders, resources, resource_shares and
 * resource_views (P9-03). Files come from the files module, subject classes and their students
 * from academics.
 */
@Module({
  imports: [TypeOrmModule.forFeature([ResourceEntity, ResourceFolderEntity, ResourceShareEntity, ResourceViewEntity]), AcademicsModule, OrganizationsModule, SubscriptionModule],
  controllers: [ResourcesController],
  providers: [ResourcesService],
  exports: [ResourcesService],
})
export class ResourcesModule {}
