import { randomUUID } from 'crypto';
import { DataSource, DeepPartial } from 'typeorm';
import { RolesEnum } from '../../src/common/enums/roles.enum';
import { ClassEntity } from '../../src/classes/entities/class.entity';
import { ExamEntity } from '../../src/exams/entities/exam.entity';
import { TestAudienceEnum } from '../../src/exams/enums/exam-wizard.enums';
import { UserEntity } from '../../src/user/entities/user.entity';
import { OrganizationEntity } from '../../src/organizations/entities/organization.entity';
import { OrganizationMemberEntity } from '../../src/organizations/entities/organization-member.entity';
import { OrganizationKindEnum } from '../../src/organizations/enums/organization-kind.enum';
import { OrganizationMemberRoleEnum } from '../../src/organizations/enums/organization-member-role.enum';
import { OrganizationStatusEnum } from '../../src/organizations/enums/organization-status.enum';

let sequence = 0;
const next = () => ++sequence;

/**
 * Data factories for API tests. Each inserts a valid row with unique values and
 * returns the saved entity; pass overrides for the fields a test cares about.
 */
export const factories = (dataSource: DataSource) => ({
  async user(role: RolesEnum, overrides: DeepPartial<UserEntity> = {}): Promise<UserEntity> {
    const n = next();
    return dataSource.getRepository(UserEntity).save({
      full_name: `${role.toLowerCase()} ${n}`,
      email: `${role.toLowerCase()}${n}-${randomUUID().slice(0, 8)}@test.local`,
      phone: `0170${String(n).padStart(7, '0')}`,
      // Tests sign their own tokens (tokenFor), so the password is never used to log in.
      password: 'not-used-in-api-tests',
      role,
      is_otp_verified: true,
      is_verified: true,
      personal_teacher_enabled: role === RolesEnum.TEACHER,
      ...overrides,
    } as DeepPartial<UserEntity>);
  },

  teacher(overrides: DeepPartial<UserEntity> = {}) {
    return this.user(RolesEnum.TEACHER, overrides);
  },

  student(overrides: DeepPartial<UserEntity> = {}) {
    return this.user(RolesEnum.STUDENT, overrides);
  },

  /** An approved organisation (a school by default) with `owner` as OWNER. */
  async organization(owner: UserEntity, overrides: DeepPartial<OrganizationEntity> = {}): Promise<OrganizationEntity> {
    const organization = await dataSource.getRepository(OrganizationEntity).save({
      name: `School ${next()}`,
      kind: OrganizationKindEnum.SCHOOL,
      status: OrganizationStatusEnum.APPROVED,
      ...overrides,
    } as DeepPartial<OrganizationEntity>);
    await this.member(organization, owner, OrganizationMemberRoleEnum.OWNER);
    return organization;
  },

  member(organization: OrganizationEntity, user: UserEntity, role: OrganizationMemberRoleEnum): Promise<OrganizationMemberEntity> {
    return dataSource.getRepository(OrganizationMemberEntity).save({
      organization_id: organization.id,
      user_id: user.id,
      role,
    } as DeepPartial<OrganizationMemberEntity>);
  },

  /** The teacher's SOLO organisation (their own workspace since P2-01), created on first use. */
  async soloOrganization(teacher: UserEntity): Promise<OrganizationEntity> {
    const existing = await dataSource
      .getRepository(OrganizationEntity)
      .createQueryBuilder('o')
      .innerJoin(OrganizationMemberEntity, 'm', 'm.organization_id = o.id')
      .where('m.user_id = :id AND m.role = :owner AND o.kind = :solo', {
        id: teacher.id,
        owner: OrganizationMemberRoleEnum.OWNER,
        solo: OrganizationKindEnum.SOLO,
      })
      .getOne();
    return existing ?? this.organization(teacher, { name: teacher.full_name, kind: OrganizationKindEnum.SOLO });
  },

  /**
   * A personal class owned by `teacher`, in their SOLO organisation (as every class is since
   * P2-01). Pass `organization_id: null` for a pre-P2-01 row.
   */
  async classOf(teacher: UserEntity, overrides: DeepPartial<ClassEntity> = {}): Promise<ClassEntity> {
    const organization_id = 'organization_id' in overrides ? overrides.organization_id : (await this.soloOrganization(teacher)).id;
    return dataSource.getRepository(ClassEntity).save({
      class_name: `Class ${next()}`,
      teacher_id: teacher.id,
      ...overrides,
      organization_id,
    } as DeepPartial<ClassEntity>);
  },

  /**
   * An exam open to anyone with the link, running now: started a minute ago, ends in an hour.
   * Override the times, audience or duration to test other cases. It is saved in the creator's
   * SOLO organisation unless `organization_id` is given.
   */
  async openExam(creator: UserEntity, overrides: DeepPartial<ExamEntity> = {}): Promise<ExamEntity> {
    const now = Date.now();
    // In the creator's SOLO organisation unless given (null = a pre-P2-01 row).
    const organization_id = 'organization_id' in overrides ? overrides.organization_id : (await this.soloOrganization(creator)).id;
    return dataSource.getRepository(ExamEntity).save({
      organization_id,
      created_by: creator.id,
      test_audience: TestAudienceEnum.ANYONE,
      exam_start_time: new Date(now - 60_000),
      exam_end_time: new Date(now + 60 * 60_000),
      duration_minutes: 30,
      ...overrides,
    } as DeepPartial<ExamEntity>);
  },
});
