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
import { FeatureOverrideEntity } from 'src/subscriptions/entities/feature-override.entity';
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

/**
 * A fresh school with one account per role, for walking through the app as each kind of user.
 * Placeholder phone numbers, same password as the other seeded accounts. Students start without
 * a class: the owner adds them in the app. A solo teacher has their own workspace.
 */
const DEMO_SCHOOL = 'Demo School';
const DEMO_STAFF: Array<{ phone: string; fullName: string; email: string; role: OrganizationMemberRoleEnum }> = [
  { phone: '01111111141', fullName: 'Demo Owner', email: 'demo.owner@yopmail.com', role: OrganizationMemberRoleEnum.OWNER },
  { phone: '01111111142', fullName: 'Demo Admin', email: 'demo.admin@yopmail.com', role: OrganizationMemberRoleEnum.ADMIN },
  { phone: '01111111143', fullName: 'Demo Staff', email: 'demo.staff@yopmail.com', role: OrganizationMemberRoleEnum.ASSISTANT },
  { phone: '01111111144', fullName: 'Rina Akter', email: 'demo.teacher1@yopmail.com', role: OrganizationMemberRoleEnum.TEACHER },
  { phone: '01111111145', fullName: 'Karim Uddin', email: 'demo.teacher2@yopmail.com', role: OrganizationMemberRoleEnum.TEACHER },
];
const DEMO_STUDENTS: Array<{ phone: string; fullName: string; email: string }> = [
  { phone: '01111111151', fullName: 'Mitu Das', email: 'demo.student1@yopmail.com' },
  { phone: '01111111152', fullName: 'Rafi Ahmed', email: 'demo.student2@yopmail.com' },
  { phone: '01111111153', fullName: 'Sumi Begum', email: 'demo.student3@yopmail.com' },
  { phone: '01111111154', fullName: 'Tanvir Hossain', email: 'demo.student4@yopmail.com' },
  { phone: '01111111155', fullName: 'Nusrat Jahan', email: 'demo.student5@yopmail.com' },
  { phone: '01111111156', fullName: 'Arif Khan', email: 'demo.student6@yopmail.com' },
];
const DEMO_SOLO_TEACHER = { phone: '01111111146', fullName: 'Solo Teacher', email: 'demo.solo@yopmail.com' };
/** Features the demo school has on, whatever its plan. */
const DEMO_FEATURES = ['attendance', 'homework', 'calendar'];

type SeedPerson = { phone: string; fullName: string; email: string };
type SeedStaff = SeedPerson & { role: OrganizationMemberRoleEnum };

/** One test school: its staff (members), students (members once enrolled in the app) and features. */
interface SeedSchool {
  name: string;
  staff: SeedStaff[];
  students: SeedPerson[];
  /** Solo teachers with their own workspace. */
  soloTeachers: SeedPerson[];
  features: string[];
}

/**
 * A large school for testing with a lot of data (co-founder review, 13 Nov): owner, admin, two
 * staff, eight teachers and sixty students. Its classes, routine, events and homework are added
 * through the API after seeding (scripts/beta-sunrise-data), so they go through the app's rules.
 */
const SUNRISE_SCHOOL = 'Sunrise School';
const SUNRISE_TEACHERS = ['Nasima Khatun', 'Abdul Karim', 'Shahana Parvin', 'Rezaul Haque', 'Tania Sultana', 'Habibur Rahman', 'Lipika Roy', 'Mizanur Rahman'];
const SUNRISE_FIRST = ['Ayesha', 'Rahim', 'Fatema', 'Sabbir', 'Nadia', 'Imran', 'Sadia', 'Tanjim', 'Mehjabin', 'Rakib', 'Farzana', 'Shakib', 'Lamia', 'Hasan', 'Riya', 'Nayeem', 'Tasnim', 'Sohel', 'Anika', 'Fahim'];
const SUNRISE_LAST = ['Rahman', 'Hossain', 'Akter', 'Islam', 'Chowdhury', 'Sarkar', 'Khan', 'Ahmed', 'Begum', 'Das', 'Roy', 'Sikder'];
const pad = (n: number, width: number) => String(n).padStart(width, '0');
const SUNRISE: SeedSchool = {
  name: SUNRISE_SCHOOL,
  staff: [
    { phone: '01111130001', fullName: 'Farhana Islam', email: 'sun.owner@yopmail.com', role: OrganizationMemberRoleEnum.OWNER },
    { phone: '01111130002', fullName: 'Mahmud Hasan', email: 'sun.admin@yopmail.com', role: OrganizationMemberRoleEnum.ADMIN },
    { phone: '01111130003', fullName: 'Shirin Akhter', email: 'sun.staff1@yopmail.com', role: OrganizationMemberRoleEnum.ASSISTANT },
    { phone: '01111130004', fullName: 'Jamal Uddin', email: 'sun.staff2@yopmail.com', role: OrganizationMemberRoleEnum.ASSISTANT },
    ...SUNRISE_TEACHERS.map((fullName, i) => ({
      phone: `011111301${pad(i + 1, 2)}`,
      fullName,
      email: `sun.teacher${i + 1}@yopmail.com`,
      role: OrganizationMemberRoleEnum.TEACHER,
    })),
  ],
  students: Array.from({ length: 60 }, (_, i) => ({
    phone: `0111114${pad(i + 1, 4)}`,
    fullName: `${SUNRISE_FIRST[i % SUNRISE_FIRST.length]} ${SUNRISE_LAST[(i * 5) % SUNRISE_LAST.length]}`,
    email: `sun.student${pad(i + 1, 2)}@yopmail.com`,
  })),
  soloTeachers: [{ phone: '01111130201', fullName: 'Kamrul Hasan', email: 'sun.solo@yopmail.com' }],
  features: ['attendance', 'homework', 'calendar'],
};
/** A platform admin account for testing the admin pages on beta. */
const TEST_PLATFORM_ADMIN: SeedPerson = { phone: '01111139999', fullName: 'Test Platform Admin', email: 'test.platform@yopmail.com' };

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
    @InjectRepository(FeatureOverrideEntity)
    private readonly overrideRepository: Repository<FeatureOverrideEntity>,
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

    const demo = await this.seedSchool(
      { name: DEMO_SCHOOL, staff: DEMO_STAFF, students: DEMO_STUDENTS, soloTeachers: [DEMO_SOLO_TEACHER], features: DEMO_FEATURES },
      hashedPassword,
    );
    this.logger.log(`Demo school: created ${demo.users} users, ${demo.members} memberships, ${demo.features} feature switches.`);
    const sunrise = await this.seedSchool(SUNRISE, hashedPassword);
    this.logger.log(`Sunrise school: created ${sunrise.users} users, ${sunrise.members} memberships, ${sunrise.features} feature switches.`);
    const admin = await this.userOf(TEST_PLATFORM_ADMIN, RolesEnum.ADMIN, false, hashedPassword);
    this.logger.log(`Test platform admin: ${admin.created ? 'created' : 'already present'}.`);
    this.logger.log(
      `Test seed complete: created ${createdOwners} owners, ${createdOrgs} orgs, ${createdStudents} students; skipped ${skipped} already present. Password for seeded accounts: ${TEST_PASSWORD}`,
    );
  }

  /** The demo school, its people and features; only what is missing is added. */
  /** A test account, created once (found by phone or email); `created` says whether it is new. */
  private async userOf(person: SeedPerson, role: RolesEnum, personal: boolean, hashedPassword: string): Promise<{ user: UserEntity; created: boolean }> {
    const existing = await this.userRepository.findOne({ where: [{ phone: person.phone }, { email: person.email }] });
    if (existing) return { user: existing, created: false };
    const user = await this.userRepository.save(
      this.userRepository.create({
        full_name: person.fullName,
        email: person.email,
        phone: person.phone,
        password: hashedPassword,
        role,
        personal_teacher_enabled: personal,
        is_otp_verified: true,
        is_verified: true,
        is_active: ActiveStatusEnum.ACTIVE,
        refresh_token: this.refreshTokenUtil.generate().hash,
        teacher_public_id: role === RolesEnum.TEACHER ? await this.publicIdService.nextTeacherPublicId() : null,
        student_public_id: role === RolesEnum.STUDENT ? await this.publicIdService.nextStudentPublicId() : null,
        public_id: null,
        created_at: new Date(),
      }),
    );
    return { user, created: true };
  }

  /** A test school with its accounts, staff memberships and features, added once. */
  private async seedSchool(school: SeedSchool, hashedPassword: string): Promise<{ users: number; members: number; features: number }> {
    const counts = { users: 0, members: 0, features: 0 };
    const userOf = async (person: SeedPerson, role: RolesEnum, personal = false): Promise<UserEntity> => {
      const { user, created } = await this.userOf(person, role, personal, hashedPassword);
      if (created) counts.users += 1;
      return user;
    };

    const staff: (SeedStaff & { user: UserEntity })[] = [];
    for (const person of school.staff) staff.push({ ...person, user: await userOf(person, RolesEnum.TEACHER) });
    for (const student of school.students) await userOf(student, RolesEnum.STUDENT);
    for (const solo of school.soloTeachers) await userOf(solo, RolesEnum.TEACHER, true);

    const owner = staff[0].user;
    let organization = await this.organizationRepository.findOne({ where: { name: school.name } });
    if (!organization) {
      const organizationNumber = await this.publicIdService.nextOrganizationPublicId();
      organization = await this.organizationRepository.save(
        this.organizationRepository.create({
          name: school.name,
          public_id: organizationNumber,
          organization_number: organizationNumber,
          status: OrganizationStatusEnum.APPROVED,
          created_by: owner.id,
          created_user_name: owner.full_name,
          created_at: new Date(),
        }),
      );
    }
    for (const person of staff) {
      const member = await this.memberRepository.findOne({ where: { organization_id: organization.id, user_id: person.user.id } });
      if (member) continue;
      await this.memberRepository.save(
        this.memberRepository.create({
          organization_id: organization.id,
          user_id: person.user.id,
          role: person.role,
          created_by: owner.id,
          created_user_name: owner.full_name,
          created_at: new Date(),
        }),
      );
      counts.members += 1;
    }
    for (const key of school.features) {
      if (await this.overrideRepository.findOne({ where: { organization_id: organization.id, key } })) continue;
      await this.overrideRepository.save(this.overrideRepository.create({ organization_id: organization.id, key, value: true, reason: `${school.name} (test seed)` }));
      counts.features += 1;
    }
    return counts;
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
