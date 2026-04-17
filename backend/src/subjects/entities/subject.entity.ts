import { Column, Entity, Index } from 'typeorm';
import { CustomBaseEntity } from 'src/common/common-entities/custom-base.enity';
import { IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

@Entity('subjects')
@Index('UQ_subjects_name', ['name'], { unique: true })
@Index('UQ_subjects_code', ['code'], { unique: true })
export class SubjectEntity extends CustomBaseEntity {
  @ApiProperty({ description: 'Display name of the subject', example: 'Mathematics' })
  @Column({ name: 'name', type: 'varchar', length: 150 })
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @ApiPropertyOptional({ description: 'Optional short code or slug', example: 'MATH-101' })
  @Column({ name: 'code', type: 'varchar', length: 50, nullable: true })
  code: string | null;
}
