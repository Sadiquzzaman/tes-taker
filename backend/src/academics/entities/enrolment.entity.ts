import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { CustomBaseEntity } from 'src/common/common-entities/custom-base.enity';
import { ClassEntity } from 'src/classes/entities/class.entity';
import { UserEntity } from 'src/user/entities/user.entity';
import { AcademicSessionEntity } from './academic-session.entity';
import { SectionEntity } from './section.entity';

export enum EnrolmentStatusEnum {
  /** Invited by phone or email; no account yet (student_id is null). */
  INVITED = 'INVITED',
  /** Asked to join; waiting for the teacher. */
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  LEFT = 'LEFT',
  PROMOTED = 'PROMOTED',
}

/**
 * A student in a section for one session (FND-04). One section per class per session.
 * Replaces class_students; rows copied or mirrored from class_students keep that row's id.
 */
@Entity('enrolments')
@Index(['session_id', 'class_id', 'student_id'], { unique: true })
@Index(['section_id', 'status'])
@Index(['organization_id', 'student_id'])
export class EnrolmentEntity extends CustomBaseEntity {
  @ApiProperty()
  @Column({ name: 'organization_id', type: 'uuid' })
  organization_id: string;

  @ApiProperty()
  @Column({ name: 'session_id', type: 'uuid' })
  session_id: string;

  @ManyToOne(() => AcademicSessionEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id' })
  session: AcademicSessionEntity;

  @ApiProperty({ description: 'Denormalised for the one-section-per-class rule' })
  @Column({ name: 'class_id', type: 'uuid' })
  class_id: string;

  @ManyToOne(() => ClassEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'class_id' })
  class: ClassEntity;

  @ApiProperty()
  @Column({ name: 'section_id', type: 'uuid' })
  section_id: string;

  @ManyToOne(() => SectionEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'section_id' })
  section: SectionEntity;

  @ApiPropertyOptional({ description: 'null while an invited student has no account' })
  @Column({ name: 'student_id', type: 'uuid', nullable: true })
  student_id: string | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student: UserEntity | null;

  @ApiPropertyOptional()
  @Column({ name: 'roll_no', type: 'varchar', length: 20, nullable: true })
  roll_no: string | null;

  @ApiProperty({ enum: EnrolmentStatusEnum })
  @Column({ name: 'status', type: 'enum', enum: EnrolmentStatusEnum })
  status: EnrolmentStatusEnum;

  @ApiPropertyOptional()
  @Column({ name: 'invited_phone', type: 'varchar', length: 15, nullable: true })
  invited_phone: string | null;

  @ApiPropertyOptional()
  @Column({ name: 'invited_email', type: 'varchar', length: 100, nullable: true })
  invited_email: string | null;

  @ApiPropertyOptional({ description: 'Name given for an invited student (CSV import); null once they have an account' })
  @Column({ name: 'invited_name', type: 'varchar', length: 150, nullable: true })
  invited_name: string | null;

  @ApiPropertyOptional()
  @Column({ name: 'invitation_token', type: 'varchar', length: 100, nullable: true })
  invitation_token: string | null;

  @ApiPropertyOptional()
  @Column({ name: 'joined_at', type: 'timestamptz', nullable: true })
  joined_at: Date | null;

  @ApiPropertyOptional()
  @Column({ name: 'left_at', type: 'timestamptz', nullable: true })
  left_at: Date | null;
}
