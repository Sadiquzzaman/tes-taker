import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { CustomBaseEntity } from 'src/common/common-entities/custom-base.enity';
import { ClassEntity } from 'src/classes/entities/class.entity';
import { UserEntity } from 'src/user/entities/user.entity';
import { AcademicSessionEntity } from './academic-session.entity';

export enum SectionShiftEnum {
  MORNING = 'MORNING',
  DAY = 'DAY',
  EVENING = 'EVENING',
}

/**
 * A section or batch of a class in one session (FND-02). A class has at least one section per
 * session it runs in. The class teacher (one per section, if the organisation uses class teachers)
 * looks after the whole section; a teacher may be class teacher of several sections.
 */
@Entity('sections')
@Index(['class_id', 'session_id', 'name'], { unique: true })
@Index(['organization_id', 'session_id'])
@Index(['class_teacher_id'])
export class SectionEntity extends CustomBaseEntity {
  @ApiProperty()
  @Column({ name: 'organization_id', type: 'uuid' })
  organization_id: string;

  @ApiProperty()
  @Column({ name: 'class_id', type: 'uuid' })
  class_id: string;

  @ManyToOne(() => ClassEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'class_id' })
  class: ClassEntity;

  @ApiProperty()
  @Column({ name: 'session_id', type: 'uuid' })
  session_id: string;

  @ManyToOne(() => AcademicSessionEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id' })
  session: AcademicSessionEntity;

  @ApiProperty({ example: 'A' })
  @Column({ name: 'name', type: 'varchar', length: 60 })
  name: string;

  @ApiPropertyOptional({ enum: SectionShiftEnum })
  @Column({ name: 'shift', type: 'enum', enum: SectionShiftEnum, nullable: true })
  shift: SectionShiftEnum | null;

  @ApiPropertyOptional({ example: 'Room 204' })
  @Column({ name: 'room', type: 'varchar', length: 40, nullable: true })
  room: string | null;

  @ApiPropertyOptional({ description: 'Used only when the organisation has class teachers switched on' })
  @Column({ name: 'class_teacher_id', type: 'uuid', nullable: true })
  class_teacher_id: string | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'class_teacher_id' })
  class_teacher: UserEntity | null;
}
