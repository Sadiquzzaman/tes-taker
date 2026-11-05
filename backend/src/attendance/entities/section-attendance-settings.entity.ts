import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { SectionEntity } from 'src/academics/entities/section.entity';
import { CustomBaseEntity } from 'src/common/common-entities/custom-base.enity';

/** Where a section's classes happen (ATT-16): at its branch, or online (check in from anywhere). */
export enum SectionClassTypeEnum {
  IN_PERSON = 'IN_PERSON',
  ONLINE = 'ONLINE',
}

/** How a section's attendance is kept: students check themselves in, or a paper register is imported (ATT-17). */
export enum SectionAttendanceModeEnum {
  SELF_CHECKIN = 'SELF_CHECKIN',
  PAPER_REGISTER = 'PAPER_REGISTER',
}

/**
 * A section's attendance setup (ATT-16). Owned by the attendance module because `sections` belongs
 * to academics; a section without a row uses the defaults (in person, self check-in, the
 * organisation's grace period).
 */
@Entity('section_attendance_settings')
@Index('UQ_section_attendance_settings_section', ['section_id'], { unique: true })
@Index('IDX_section_attendance_settings_organization', ['organization_id'])
@Check('CHK_section_attendance_settings_grace', `"grace_minutes" IS NULL OR "grace_minutes" BETWEEN 0 AND 60`)
export class SectionAttendanceSettingsEntity extends CustomBaseEntity {
  @ApiProperty()
  @Column({ name: 'organization_id', type: 'uuid' })
  organization_id: string;

  @ApiProperty()
  @Column({ name: 'section_id', type: 'uuid' })
  section_id: string;

  @ManyToOne(() => SectionEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'section_id', foreignKeyConstraintName: 'FK_section_attendance_settings_section' })
  section: SectionEntity;

  @ApiProperty({ enum: SectionClassTypeEnum })
  @Column({ name: 'class_type', type: 'enum', enum: SectionClassTypeEnum, enumName: 'section_class_type', default: SectionClassTypeEnum.IN_PERSON })
  class_type: SectionClassTypeEnum;

  @ApiProperty({ enum: SectionAttendanceModeEnum })
  @Column({ name: 'mode', type: 'enum', enum: SectionAttendanceModeEnum, enumName: 'section_attendance_mode', default: SectionAttendanceModeEnum.SELF_CHECKIN })
  mode: SectionAttendanceModeEnum;

  @ApiPropertyOptional({ description: "Minutes before Late (0–60); null = the organisation's grace period" })
  @Column({ name: 'grace_minutes', type: 'smallint', nullable: true })
  grace_minutes: number | null;
}
