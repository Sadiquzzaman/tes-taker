import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { CustomBaseEntity } from 'src/common/common-entities/custom-base.enity';
import { GradingScaleEntity } from './grading-scale.entity';

/** One band of a grading scale: `min_pct`–`max_pct` (inclusive) earns `grade` and `gpa`. Never edited in place. */
@Entity('grading_bands')
@Index(['scale_id'])
export class GradingBandEntity extends CustomBaseEntity {
  @ApiProperty()
  @Column({ name: 'scale_id', type: 'uuid' })
  scale_id: string;

  @ManyToOne(() => GradingScaleEntity, (scale) => scale.bands, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'scale_id' })
  scale: GradingScaleEntity;

  @ApiProperty({ example: '80.00', description: 'numeric(5,2), returned as a string by the driver' })
  @Column({ name: 'min_pct', type: 'numeric', precision: 5, scale: 2 })
  min_pct: string;

  @ApiProperty({ example: '100.00' })
  @Column({ name: 'max_pct', type: 'numeric', precision: 5, scale: 2 })
  max_pct: string;

  @ApiProperty({ example: 'A+' })
  @Column({ name: 'grade', type: 'varchar', length: 5 })
  grade: string;

  @ApiPropertyOptional({ example: '5.00' })
  @Column({ name: 'gpa', type: 'numeric', precision: 3, scale: 2, nullable: true })
  gpa: string | null;
}
