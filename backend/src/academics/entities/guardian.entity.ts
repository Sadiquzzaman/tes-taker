import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { CustomBaseEntity } from 'src/common/common-entities/custom-base.enity';
import { UserEntity } from 'src/user/entities/user.entity';
import { EnrolmentEntity } from './enrolment.entity';

export enum GuardianRelationEnum {
  FATHER = 'FATHER',
  MOTHER = 'MOTHER',
  OTHER = 'OTHER',
}

/** Live rows (removed ones keep `deleted_at` and `deleted_by`). */
const LIVE = `"deleted_at" IS NULL`;

/**
 * A student's guardian (FND-09): up to 2 per student per organisation (checked in GuardiansService),
 * one of them primary. A student who has not signed up yet is reached through their invited
 * enrolment (`enrolment_id`, `student_id` null); when they join, `student_id` is filled in.
 * Never hard-deleted: a removed guardian keeps the row with `deleted_at` and `deleted_by`.
 */
@Entity('guardians')
@Check('CHK_guardians_student_or_enrolment', `"student_id" IS NOT NULL OR "enrolment_id" IS NOT NULL`)
@Check('CHK_guardians_sms_locale', `"sms_locale" IS NULL OR "sms_locale" IN ('bn', 'en')`)
@Index('UQ_guardians_student_phone', ['organization_id', 'student_id', 'phone'], { unique: true, where: `${LIVE} AND "student_id" IS NOT NULL` })
@Index('UQ_guardians_enrolment_phone', ['organization_id', 'enrolment_id', 'phone'], { unique: true, where: `${LIVE} AND "student_id" IS NULL` })
@Index('UQ_guardians_student_primary', ['organization_id', 'student_id'], { unique: true, where: `${LIVE} AND "is_primary" AND "student_id" IS NOT NULL` })
@Index('UQ_guardians_enrolment_primary', ['organization_id', 'enrolment_id'], { unique: true, where: `${LIVE} AND "is_primary" AND "student_id" IS NULL` })
@Index('IDX_guardians_enrolment', ['enrolment_id'])
export class GuardianEntity extends CustomBaseEntity {
  @ApiProperty()
  @Column({ name: 'organization_id', type: 'uuid' })
  organization_id: string;

  @ApiPropertyOptional({ description: 'null while the student has not signed up (see enrolment_id)' })
  @Column({ name: 'student_id', type: 'uuid', nullable: true })
  student_id: string | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student: UserEntity | null;

  @ApiPropertyOptional({ description: 'The enrolment the guardian was added on (the only link for an invited student)' })
  @Column({ name: 'enrolment_id', type: 'uuid', nullable: true })
  enrolment_id: string | null;

  @ManyToOne(() => EnrolmentEntity, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'enrolment_id' })
  enrolment: EnrolmentEntity | null;

  @ApiProperty()
  @Column({ name: 'name', type: 'varchar', length: 120 })
  name: string;

  @ApiProperty({ enum: GuardianRelationEnum })
  @Column({ name: 'relation', type: 'enum', enum: GuardianRelationEnum, enumName: 'guardian_relation' })
  relation: GuardianRelationEnum;

  @ApiProperty({ example: '01XXXXXXXXX' })
  @Column({ name: 'phone', type: 'varchar', length: 14 })
  phone: string;

  @ApiProperty()
  @Column({ name: 'is_primary', type: 'boolean', default: false })
  is_primary: boolean;

  @ApiPropertyOptional({ description: "bn | en: the student's SMS language; null = the organisation's (FND-10)" })
  @Column({ name: 'sms_locale', type: 'varchar', length: 5, nullable: true })
  sms_locale: string | null;

  @ApiPropertyOptional()
  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  @ApiPropertyOptional()
  @Column({ name: 'deleted_by', type: 'uuid', nullable: true })
  deleted_by: string | null;
}
