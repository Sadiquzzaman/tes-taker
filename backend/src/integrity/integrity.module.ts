import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HomeworkModule } from 'src/homework/homework.module';
import { IeltsModule } from 'src/ielts/ielts.module';
import { OrganizationsModule } from 'src/organizations/organization.module';
import { SubscriptionModule } from 'src/subscriptions/subscription.module';
import { SimilarityCheckEntity } from './entities/similarity-check.entity';
import { SimilarityMatchEntity } from './entities/similarity-match.entity';
import { IntegrityController } from './integrity.controller';
import { IntegrityService } from './integrity.service';

/** Plagiarism checks (Epic 10, design §9.10): owns similarity_checks and similarity_matches. */
@Module({
  imports: [TypeOrmModule.forFeature([SimilarityCheckEntity, SimilarityMatchEntity]), HomeworkModule, IeltsModule, OrganizationsModule, SubscriptionModule],
  controllers: [IntegrityController],
  providers: [IntegrityService],
})
export class IntegrityModule {}
