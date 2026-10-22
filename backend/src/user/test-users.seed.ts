import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActiveStatusEnum } from 'src/common/enums/active-status.enum';
import { RolesEnum } from 'src/common/enums/roles.enum';
import { PublicIdService } from 'src/common/services/public-id.service';
import { CryptoUtil } from 'src/common/utils/crypto.util';
import { RefreshTokenUtil } from 'src/common/utils/refresh-token.util';
import { OrganizationEntity } from 'src/organizations/entities/organization.entity';
import { OrganizationMemberEntity } from 'src/organizations/entities/organization-member.entity';
import { OrganizationMemberRoleEnum } from 'src/organizations/enums/organization-member-role.enum';
import { OrganizationStatusEnum } from 'src/organizations/enums/organization-status.enum';
import { UserEntity } from './entities/user.entity';

const TEST_PASSWORD = '12345678';

const ORG_OWNERS: Array<{
  phone: string;
  fullName: string;
  email: string;
  organizationName: string;
}> = [
  {
    phone: '01111111111',
    fullName: 'Karim Hassan',
    email: 'org1.owner@yopmail.com',
    organizationName: 'Organisation 1',
  },
  {
    phone: '01111111112',
    fullName: 'Nazia Rahman',
    email: 'org2.owner@yopmail.com',
    organizationName: 'Organisation 2',
  },
  {
    phone: '01111111113',
    fullName: 'Imran Chowdhury',
    email: 'org3.owner@yopmail.com',
    organizationName: 'Organisation 3',
  },
];

const STUDENTS: Array<{ phone: string; fullName: string; email: string }> = [
  { phone: '01111111114', fullName: 'Student One', email: 'student1@yopmail.com' },
  { phone: '01111111115', fullName: 'Student Two', email: 'student2@yopmail.com' },
  { phone: '01111111116', fullName: 'Student Three', email: 'student3@yopmail.com' },
  { phone: '01111111117', fullName: 'Student Four', email: 'student4@yopmail.com' },
  { phone: '01111111118', fullName: 'Student Five', email: 'student5@yopmail.com' },
  { phone: '01111111119', fullName: 'Student Six', email: 'student6@yopmail.com' },
  { phone: '01111111121', fullName: 'Student Seven', email: 'student7@yopmail.com' },
  { phone: '01111111122', fullName: 'Student Eight', email: 'student8@yopmail.com' },
  { phone: '01111111123', fullName: 'Student Nine', email: 'student9@yopmail.com' },
];

@Injectable()
export class TestUsersSeedService {
  private readonly logger = new Logger(TestUsersSeedService.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(OrganizationEntity)
    private readonly organizationRepository: Repository<OrganizationEntity>,
    @InjectRepository(OrganizationMemberEntity)
    private readonly memberRepository: Repository<OrganizationMemberEntity>,
    private readonly configService: ConfigService,
    private readonly crypto: CryptoUtil,
    private readonly refreshTokenUtil: RefreshTokenUtil,
    private readonly publicIdService: PublicIdService,
  ) {}

  async seedIfEnabled(): Promise<void> {
    // const nodeEnv = this.configService.get<string>('NODE_ENV') || process.env.NODE_ENV;
    // if (nodeEnv === 'production') {
    //   return;
    // }

    const flag = (this.configService.get<string>('SEED_TEST_USERS') || process.env.SEED_TEST_USERS || '')
      .trim()
      .toLowerCase();
    if (flag !== 'true' && flag !== '1') {
      return;
    }

    this.logger.log('SEED_TEST_USERS enabled — seeding missing org owners and students only...');

    const hashedPassword = await this.crypto.hashPassword(TEST_PASSWORD);
    let createdOwners = 0;
    let createdStudents = 0;
    let createdOrgs = 0;
    let skipped = 0;

    for (const owner of ORG_OWNERS) {
      if (await this.credentialsExist(owner.phone, owner.email)) {
        skipped += 1;
        continue;
      }

      const existingOrg = await this.organizationRepository.findOne({
        where: { name: owner.organizationName },
      });
      if (existingOrg) {
        this.logger.warn(
          `Skipping owner ${owner.phone}: organization "${owner.organizationName}" already exists`,
        );
        skipped += 1;
        continue;
      }

      const user = await this.userRepository.save(
        this.userRepository.create({
          full_name: owner.fullName,
          email: owner.email,
          phone: owner.phone,
          password: hashedPassword,
          role: RolesEnum.TEACHER,
          personal_teacher_enabled: false,
          is_otp_verified: true,
          is_verified: true,
          is_active: ActiveStatusEnum.ACTIVE,
          refresh_token: this.refreshTokenUtil.generate().hash,
          teacher_public_id: await this.publicIdService.nextTeacherPublicId(),
          student_public_id: null,
          public_id: null,
          created_at: new Date(),
        }),
      );

      const organizationNumber = await this.publicIdService.nextOrganizationPublicId();
      const organization = await this.organizationRepository.save(
        this.organizationRepository.create({
          name: owner.organizationName,
          public_id: organizationNumber,
          organization_number: organizationNumber,
          status: OrganizationStatusEnum.APPROVED,
          created_by: user.id,
          created_user_name: owner.fullName,
          created_at: new Date(),
        }),
      );

      await this.memberRepository.save(
        this.memberRepository.create({
          organization_id: organization.id,
          user_id: user.id,
          role: OrganizationMemberRoleEnum.OWNER,
          created_by: user.id,
          created_user_name: owner.fullName,
          created_at: new Date(),
        }),
      );

      createdOwners += 1;
      createdOrgs += 1;
    }

    for (const student of STUDENTS) {
      if (await this.credentialsExist(student.phone, student.email)) {
        skipped += 1;
        continue;
      }

      await this.userRepository.save(
        this.userRepository.create({
          full_name: student.fullName,
          email: student.email,
          phone: student.phone,
          password: hashedPassword,
          role: RolesEnum.STUDENT,
          personal_teacher_enabled: false,
          is_otp_verified: true,
          is_verified: true,
          is_active: ActiveStatusEnum.ACTIVE,
          refresh_token: this.refreshTokenUtil.generate().hash,
          student_public_id: await this.publicIdService.nextStudentPublicId(),
          teacher_public_id: null,
          public_id: null,
          created_at: new Date(),
        }),
      );
      createdStudents += 1;
    }

    this.logger.log(
      `Test seed complete: created ${createdOwners} owners, ${createdOrgs} orgs, ${createdStudents} students; skipped ${skipped} already present. Password for seeded accounts: ${TEST_PASSWORD}`,
    );
  }

  /** True when phone or email already belongs to a user in the DB. */
  private async credentialsExist(phone: string, email: string): Promise<boolean> {
    const byPhone = await this.userRepository.findOne({ where: { phone } });
    if (byPhone) {
      return true;
    }
    const byEmail = await this.userRepository.findOne({
      where: { email: email.toLowerCase() },
    });
    return Boolean(byEmail);
  }
}
