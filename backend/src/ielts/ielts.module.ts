import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationsModule } from 'src/organizations/organization.module';
import { SubscriptionModule } from 'src/subscriptions/subscription.module';
import { IeltsBandTableEntity } from './entities/ielts-band-table.entity';
import { IeltsProfileEntity } from './entities/ielts-profile.entity';
import { IeltsBandTablesService } from './ielts-band-tables.service';
import { IeltsController } from './ielts.controller';
import { IeltsProfilesService } from './ielts-profiles.service';

/**
 * The IELTS workspace (Epic 11, re-designed 15 Nov 2026; design §9.10): owns ielts_profiles
 * (P10-01) and ielts_band_tables (P10-02). IELTS tests and attempts come in the next packages.
 */
@Module({
  imports: [TypeOrmModule.forFeature([IeltsProfileEntity, IeltsBandTableEntity]), OrganizationsModule, SubscriptionModule],
  controllers: [IeltsController],
  providers: [IeltsProfilesService, IeltsBandTablesService],
  exports: [IeltsProfilesService, IeltsBandTablesService],
})
export class IeltsModule {}
