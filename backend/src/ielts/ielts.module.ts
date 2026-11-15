import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationsModule } from 'src/organizations/organization.module';
import { SubscriptionModule } from 'src/subscriptions/subscription.module';
import { IeltsProfileEntity } from './entities/ielts-profile.entity';
import { IeltsController } from './ielts.controller';
import { IeltsProfilesService } from './ielts-profiles.service';

/**
 * The IELTS workspace (Epic 11, re-designed 15 Nov 2026; design §9.10): owns ielts_profiles
 * (P10-01). IELTS tests, attempts and bands come in the next packages.
 */
@Module({
  imports: [TypeOrmModule.forFeature([IeltsProfileEntity]), OrganizationsModule, SubscriptionModule],
  controllers: [IeltsController],
  providers: [IeltsProfilesService],
  exports: [IeltsProfilesService],
})
export class IeltsModule {}
