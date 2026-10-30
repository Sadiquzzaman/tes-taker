import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { CustomBaseEntity } from 'src/common/common-entities/custom-base.enity';
import { AcademicSessionEntity } from './academic-session.entity';

/** A term inside a session, e.g. অর্ধ বার্ষিক পরীক্ষা (PRF-02). */
@Entity('terms')
@Index(['organization_id', 'session_id'])
export class TermEntity extends CustomBaseEntity {
  @ApiProperty()
  @Column({ name: 'organization_id', type: 'uuid' })
  organization_id: string;

  @ApiProperty()
  @Column({ name: 'session_id', type: 'uuid' })
  session_id: string;

  @ManyToOne(() => AcademicSessionEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id' })
  session: AcademicSessionEntity;

  @ApiProperty({ example: 'Half-yearly' })
  @Column({ name: 'name', type: 'varchar', length: 80 })
  name: string;

  @ApiPropertyOptional()
  @Column({ name: 'start_date', type: 'date', nullable: true })
  start_date: string | null;

  @ApiPropertyOptional()
  @Column({ name: 'end_date', type: 'date', nullable: true })
  end_date: string | null;

  @ApiProperty()
  @Column({ name: 'sort_order', type: 'smallint', default: 0 })
  sort_order: number;
}
