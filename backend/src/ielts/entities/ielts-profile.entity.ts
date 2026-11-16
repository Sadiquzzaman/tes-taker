import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { OrganizationEntity } from 'src/organizations/entities/organization.entity';
import { UserEntity } from 'src/user/entities/user.entity';

export enum IeltsTestTypeEnum {
  ACADEMIC = 'ACADEMIC',
  GENERAL = 'GENERAL',
}

export enum IeltsModuleEnum {
  LISTENING = 'LISTENING',
  READING = 'READING',
  WRITING = 'WRITING',
  SPEAKING = 'SPEAKING',
}

/** A student's IELTS profile in a centre (IEL-02): test type, target bands, booked test date. */
@Entity('ielts_profiles')
@Index('UQ_ielts_profiles_org_student', ['organization_id', 'student_id'], { unique: true })
@Check('CHK_ielts_profiles_test_type', `"test_type" IS NULL OR "test_type" IN ('ACADEMIC', 'GENERAL')`)
@Check('CHK_ielts_profiles_target', `"target_overall" IS NULL OR ("target_overall" >= 0 AND "target_overall" <= 9)`)
export class IeltsProfileEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organization_id: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id', foreignKeyConstraintName: 'FK_ielts_profiles_organization' })
  organization?: OrganizationEntity;

  @Column({ name: 'student_id', type: 'uuid' })
  student_id: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id', foreignKeyConstraintName: 'FK_ielts_profiles_student' })
  student?: UserEntity;

  @Column({ name: 'test_type', type: 'varchar', length: 10, nullable: true })
  test_type: IeltsTestTypeEnum | null;

  @Column({ name: 'target_overall', type: 'numeric', precision: 2, scale: 1, nullable: true })
  target_overall: string | null;

  /** Target band per module, e.g. { LISTENING: 7, WRITING: 6.5 }. */
  @Column({ name: 'target_bands', type: 'jsonb', default: () => "'{}'" })
  target_bands: Partial<Record<IeltsModuleEnum, number>>;

  @Column({ name: 'test_date', type: 'date', nullable: true })
  test_date: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updated_by: string | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  created_at: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updated_at: Date;
}
