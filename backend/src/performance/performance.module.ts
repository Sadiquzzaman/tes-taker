import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationsModule } from 'src/organizations/organization.module';
import { GradingBandEntity } from './entities/grading-band.entity';
import { GradingScaleEntity } from './entities/grading-scale.entity';
import { GradingScaleController } from './grading-scale.controller';
import { GradingScaleService } from './grading-scale.service';

/** Performance & reporting (Epic 3, design §4). So far: the grading scale (FND-11). */
@Module({
  imports: [TypeOrmModule.forFeature([GradingScaleEntity, GradingBandEntity]), OrganizationsModule],
  controllers: [GradingScaleController],
  providers: [GradingScaleService],
  exports: [GradingScaleService],
})
export class PerformanceModule {}
