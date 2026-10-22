import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { RegisterUserDto } from 'src/auth/dto/register-user.dto';
import { LoginDto } from 'src/auth/dto/login.dto';
import { ActiveStatusEnum } from 'src/common/enums/active-status.enum';
import { RolesEnum } from 'src/common/enums/roles.enum';
import { CryptoUtil } from 'src/common/utils/crypto.util';
import { RefreshTokenUtil } from 'src/common/utils/refresh-token.util';
import { UserFilterUtil } from 'src/common/utils/user-filter.util';
import { SubscriptionService } from 'src/subscriptions/subscription.service';
import { Brackets, In, Repository } from 'typeorm';
import { UserReponseDto } from './dto/user-response.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UserEntity } from './entities/user.entity';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';
import { PublicIdService } from 'src/common/services/public-id.service';
import { normalizeEmail, normalizePhone } from 'src/common/utils/contact.util';
import { TestUsersSeedService } from './test-users.seed';

type AdminUserListMeta = {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
};

type AdminUserSummary = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: RolesEnum;
  is_active: ActiveStatusEnum;
  is_verified: boolean;
  is_otp_verified: boolean;
  created_at: Date;
};

@Injectable()
export class UserService implements OnModuleInit {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly crypto: CryptoUtil,
    private readonly refreshTokenUtil: RefreshTokenUtil,
    private readonly userFilterUtil: UserFilterUtil,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly subscriptionService: SubscriptionService,
    private readonly publicIdService: PublicIdService,
    private readonly testUsersSeedService: TestUsersSeedService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedDefaultAdminIfMissing();
    await this.ensureSuperAdminExists();
    await this.testUsersSeedService.seedIfEnabled();
  }

  /**
   * Ensures at least one SUPER_ADMIN exists after boot.
   * Env: ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_PHONE
   * Dev defaults (only when env vars are missing):
   *   name=Admin, email=admin@testtaker.local, password=Admin@12345, phone=ADMIN00000001
   *
   * Organization approval requires SUPER_ADMIN. Prefer seeding SUPER_ADMIN so the
   * admin portal shows Organizations without a manual role change.
   */
  private async seedDefaultAdminIfMissing(): Promise<void> {
    const existingAdmin = await this.userRepository.findOne({
      where: {
        role: In([RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN]),
      },
    });

    if (existingAdmin) {
      return;
    }

    const fullName = this.configService.get<string>('ADMIN_NAME')?.trim() || 'Admin';
    const email =
      this.configService.get<string>('ADMIN_EMAIL')?.trim().toLowerCase() || 'admin@testtaker.local';
    const password = this.configService.get<string>('ADMIN_PASSWORD') || 'Admin@12345';
    const phone = this.configService.get<string>('ADMIN_PHONE')?.trim() || 'ADMIN00000001';

    const existingByEmail = await this.findByEmail(email);
    if (existingByEmail) {
      existingByEmail.role = RolesEnum.SUPER_ADMIN;
      existingByEmail.is_otp_verified = true;
      existingByEmail.is_verified = true;
      existingByEmail.is_active = ActiveStatusEnum.ACTIVE;
      await this.userRepository.save(existingByEmail);
      this.logger.log(`Promoted existing user ${email} to SUPER_ADMIN (no admin was present)`);
      return;
    }

    const existingByPhone = await this.findByPhone(phone);
    if (existingByPhone) {
      existingByPhone.role = RolesEnum.SUPER_ADMIN;
      existingByPhone.is_otp_verified = true;
      existingByPhone.is_verified = true;
      existingByPhone.is_active = ActiveStatusEnum.ACTIVE;
      if (!existingByPhone.email) {
        existingByPhone.email = email;
      }
      await this.userRepository.save(existingByPhone);
      this.logger.log(`Promoted existing user with phone ${phone} to SUPER_ADMIN (no admin was present)`);
      return;
    }

    const hashedPassword = await this.crypto.hashPassword(password);
    const refreshTokenHash = this.refreshTokenUtil.generate().hash;

    await this.userRepository.save({
      full_name: fullName,
      email,
      phone,
      password: hashedPassword,
      role: RolesEnum.SUPER_ADMIN,
      is_otp_verified: true,
      is_verified: true,
      is_active: ActiveStatusEnum.ACTIVE,
      refresh_token: refreshTokenHash,
      created_at: new Date(),
    });

    this.logger.warn(
      `Seeded default SUPER_ADMIN user (${email}). Change ADMIN_PASSWORD immediately in production.`,
    );
  }

  /**
   * If the DB was seeded earlier as ADMIN only, promote the default admin account
   * so organization approval is available in the portal.
   */
  private async ensureSuperAdminExists(): Promise<void> {
    const existingSuperAdmin = await this.userRepository.findOne({
      where: { role: RolesEnum.SUPER_ADMIN },
    });
    if (existingSuperAdmin) {
      return;
    }

    const email =
      this.configService.get<string>('ADMIN_EMAIL')?.trim().toLowerCase() || 'admin@testtaker.local';
    const phone = this.configService.get<string>('ADMIN_PHONE')?.trim() || 'ADMIN00000001';

    let candidate =
      (await this.findByEmail(email)) ||
      (await this.findByPhone(phone)) ||
      (await this.userRepository.findOne({ where: { role: RolesEnum.ADMIN } }));

    if (!candidate) {
      return;
    }

    candidate.role = RolesEnum.SUPER_ADMIN;
    candidate.is_otp_verified = true;
    candidate.is_verified = true;
    candidate.is_active = ActiveStatusEnum.ACTIVE;
    await this.userRepository.save(candidate);
    this.logger.warn(
      `Promoted ${candidate.email || candidate.phone} to SUPER_ADMIN so organization approval is available.`,
    );
  }

  async create(registerUserDto: RegisterUserDto | any): Promise<UserEntity> {
    // Check for duplicate email if provided
    if (registerUserDto.email) {
      const isEmailDuplicate = await this.userRepository.findOne({
        where: { email: registerUserDto.email },
      });

      if (isEmailDuplicate && isEmailDuplicate.is_otp_verified) {
        throw new BadRequestException('Email already exists!');
      }
    }

    // Hash password
    registerUserDto.password = await this.crypto.hashPassword(registerUserDto.password);

    const verificationToken = this.generateVerificationToken();
    // Store only the hash of a securely generated refresh token. It is replaced
    // on first login, but we never persist a weak or plaintext value.
    const refreshTokenHash = this.refreshTokenUtil.generate().hash;

    const studentPublicId =
      registerUserDto.role === RolesEnum.STUDENT || !registerUserDto.role
        ? await this.publicIdService.nextStudentPublicId()
        : registerUserDto.student_public_id ?? null;
    const teacherPublicId =
      registerUserDto.role === RolesEnum.TEACHER || registerUserDto.ensure_teacher_public_id
        ? await this.publicIdService.nextTeacherPublicId()
        : null;

    const {
      confirm_password: _confirm,
      ensure_teacher_public_id: _ensureTeacher,
      personal_teacher_enabled: personalTeacherFlag,
      student_public_id: _studentPid,
      ...rest
    } = registerUserDto;

    const userEntity = {
      ...rest,
      verification_token: verificationToken,
      is_active: registerUserDto.is_active || ActiveStatusEnum.ACTIVE,
      refresh_token: refreshTokenHash,
      is_otp_verified: registerUserDto.is_otp_verified || false,
      is_verified: registerUserDto.is_verified || false,
      personal_teacher_enabled: personalTeacherFlag === true,
      public_id: null,
      student_public_id: studentPublicId,
      teacher_public_id: teacherPublicId,
      created_at: new Date(),
    };

    const user = await this.userRepository.save(userEntity);
    delete user.password;
    return user;
  }

  /**
   * Ensure teacher public id exists without enabling personal teacher context.
   * Used for org teachers/owners who need TEACHER platform role for RolesGuard.
   */
  async ensureTeacherCapability(userId: string, options?: { enablePersonal?: boolean }): Promise<UserEntity> {
    const user = await this.findById(userId);
    let changed = false;

    if (user.role !== RolesEnum.TEACHER && user.role !== RolesEnum.ADMIN && user.role !== RolesEnum.SUPER_ADMIN) {
      user.role = RolesEnum.TEACHER;
      changed = true;
    }

    if (!user.teacher_public_id) {
      user.teacher_public_id = await this.publicIdService.nextTeacherPublicId();
      changed = true;
    }

    if (options?.enablePersonal && !user.personal_teacher_enabled) {
      user.personal_teacher_enabled = true;
      changed = true;
    }

    if (changed) {
      return this.userRepository.save(user);
    }
    return user;
  }

  async enablePersonalTeacherContext(userId: string): Promise<UserEntity> {
    const user = await this.ensureTeacherCapability(userId, { enablePersonal: true });
    try {
      await this.subscriptionService.provisionFreePlan(user.id, user.full_name ?? 'Teacher');
    } catch (error) {
      this.logger.error(
        `Failed to provision free subscription for personal teacher: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return user;
  }

  /** Ensure a stable numeric Student ID (1000001+) exists once per user. */
  async ensureStudentPublicId(userId: string): Promise<UserEntity> {
    const user = await this.findById(userId);
    if (user.student_public_id) {
      return user;
    }
    user.student_public_id = await this.publicIdService.nextStudentPublicId();
    return this.userRepository.save(user);
  }

  generateVerificationToken(): string {
    const timestamp = new Date().getTime().toString(16).slice(-8);
    const randomToken = (Math.random() * 0xfffff * 1000000)
      .toString(16)
      .slice(0, 12);

    const verificationToken = timestamp + randomToken;
    return verificationToken;
  }

  async findById(id: string): Promise<UserEntity> {
    const user = await this.userRepository.findOne({
      where: {
        id,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    return await this.userRepository.findOne({
      where: { email },
    });
  }

  async findByGoogleId(googleId: string): Promise<UserEntity | null> {
    return await this.userRepository.findOne({
      where: { google_id: googleId },
    });
  }

  private buildSyntheticGooglePhone(seed: string): string {
    const digits = seed.replace(/\D/g, '').slice(-10).padStart(10, '0');
    return `G${digits}`.slice(0, 15);
  }

  async findOrCreateGoogleUser(profile: {
    googleId: string;
    email: string;
    fullName: string;
  }): Promise<UserEntity> {
    let user = await this.findByGoogleId(profile.googleId);

    if (user) {
      if (user.is_active === ActiveStatusEnum.INACTIVE) {
        throw new UnauthorizedException('Your account has been disabled. Please contact support.');
      }
      return user;
    }

    user = await this.findByEmail(profile.email);
    if (user) {
      if (user.google_id && user.google_id !== profile.googleId) {
        throw new BadRequestException('This email is linked to a different Google account');
      }

      user.google_id = profile.googleId;
      user.full_name = user.full_name || profile.fullName;
      user.is_otp_verified = true;
      user.is_verified = true;

      if (user.is_active === ActiveStatusEnum.INACTIVE) {
        throw new UnauthorizedException('Your account has been disabled. Please contact support.');
      }

      return this.userRepository.save(user);
    }

    const password = await this.crypto.hashPassword(randomBytes(32).toString('hex'));
    let phone = this.buildSyntheticGooglePhone(profile.googleId);
    while (await this.findByPhone(phone)) {
      phone = this.buildSyntheticGooglePhone(`${profile.googleId}-${randomBytes(4).toString('hex')}`);
    }

    return this.userRepository.save({
      full_name: profile.fullName,
      email: profile.email,
      google_id: profile.googleId,
      phone,
      password,
      role: RolesEnum.STUDENT,
      is_otp_verified: true,
      is_verified: true,
      is_active: ActiveStatusEnum.ACTIVE,
      refresh_token: this.refreshTokenUtil.generate().hash,
      created_at: new Date(),
    });
  }

  async generateTokenForUser(
    user: UserEntity,
    orgSession?: {
      organization_id: string;
      organization_number: number;
      member_role: string;
      organization_name: string;
      organization_status: string;
    } | null,
    options?: {
      context_type?:
        | 'personal_teacher'
        | 'organization'
        | 'individual_teacher'
        | 'individual';
      teacher_id?: string;
    },
  ): Promise<UserReponseDto> {
    const contextType =
      options?.context_type ??
      (orgSession ? 'organization' : 'individual');

    const access_token = this.generateJwtToken(
      user,
      orgSession ?? null,
      contextType,
      options?.teacher_id,
    );

    const { token, hash } = this.refreshTokenUtil.generate();
    user.refresh_token = hash;
    await user.save();

    const base: UserReponseDto = {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      phone: user.phone,
      is_verified: user.is_verified,
      role: user.role,
      personal_teacher_enabled: Boolean(user.personal_teacher_enabled),
      public_id: user.public_id ?? null,
      teacher_public_id: user.teacher_public_id ?? null,
      student_public_id: user.student_public_id ?? null,
      context_type: contextType,
      teacher_id: options?.teacher_id ?? null,
      session_mode: orgSession ? 'organization' : 'individual',
      organization: orgSession
        ? {
            id: orgSession.organization_id,
            name: orgSession.organization_name,
            organization_number: orgSession.organization_number,
            role: orgSession.member_role,
            status: orgSession.organization_status,
          }
        : null,
      access_token,
      refresh_token: token,
    };

    return base;
  }

  async assertLoginCredentials(loginDto: Pick<LoginDto, 'phone' | 'email' | 'password'>): Promise<UserEntity> {
    let user: UserEntity | null;

    if (loginDto.email && loginDto.email.includes('@')) {
      user = await this.userRepository.findOne({
        where: { email: loginDto.email.trim().toLowerCase() },
      });
    } else if (loginDto.phone) {
      user = await this.userRepository.findOne({
        where: { phone: loginDto.phone },
      });
    } else {
      throw new UnauthorizedException('Invalid login credentials');
    }

    if (!user) {
      throw new UnauthorizedException('Invalid login credentials');
    }

    if (!(await this.crypto.comparePassword(loginDto.password, user.password))) {
      throw new UnauthorizedException('Invalid login credentials');
    }

    if (!user.is_otp_verified || !user.is_verified) {
      throw new UnauthorizedException('Please verify your phone number with OTP before logging in');
    }

    if (user.is_active === ActiveStatusEnum.INACTIVE) {
      throw new UnauthorizedException('Your account has been disabled. Please contact support.');
    }

    return user;
  }

  async validateUserEmailPass(loginDto: LoginDto): Promise<UserReponseDto> {
    const user = await this.assertLoginCredentials(loginDto);
    return this.generateTokenForUser(user, null);
  }

  async authenticateForOrganizationLogin(params: {
    phone: string;
    password: string;
    organization_id: string;
    organization_number: number;
    member_role: string;
    organization_name: string;
    organization_status: string;
  }): Promise<UserReponseDto> {
    const user = await this.userRepository.findOne({
      where: { phone: params.phone },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid login credentials');
    }

    if (!(await this.crypto.comparePassword(params.password, user.password))) {
      throw new UnauthorizedException('Invalid login credentials');
    }

    if (!user.is_otp_verified || !user.is_verified) {
      throw new UnauthorizedException('Please verify your phone number with OTP before logging in');
    }

    if (user.is_active === ActiveStatusEnum.INACTIVE) {
      throw new UnauthorizedException('Your account has been disabled. Please contact support.');
    }

    return this.generateTokenForUser(user, {
      organization_id: params.organization_id,
      organization_number: params.organization_number,
      member_role: params.member_role,
      organization_name: params.organization_name,
      organization_status: params.organization_status,
    });
  }

  private generateJwtToken(
    user: UserEntity,
    orgSession?: {
      organization_id: string;
      organization_number: number;
      member_role: string;
    } | null,
    contextType:
      | 'personal_teacher'
      | 'organization'
      | 'individual_teacher'
      | 'individual' = 'individual',
    teacherId?: string,
  ): string {
    const payload: Record<string, unknown> = {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      phone: user.phone,
      personal_teacher_enabled: Boolean(user.personal_teacher_enabled),
      context_type: contextType,
      session_mode: orgSession ? 'organization' : 'individual',
    };

    if (orgSession) {
      payload.organization_id = orgSession.organization_id;
      payload.organization_number = orgSession.organization_number;
      payload.member_role = orgSession.member_role;
    }

    if (teacherId) {
      payload.teacher_id = teacherId;
    }

    const token = this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_SECRET'),
      expiresIn: '30m',
    });

    return token;
  }

  async findByPhone(phone: string): Promise<UserEntity | null> {
    return await this.userRepository.findOne({
      where: { phone },
    });
  }

  async findByPhoneOrEmail(identifier: string): Promise<UserEntity | null> {
    const trimmed = identifier.trim();

    if (trimmed.includes('@')) {
      return await this.findByEmail(trimmed.toLowerCase());
    }

    return await this.findByPhone(trimmed);
  }

  async findByTeacherPublicId(teacherPublicId: string): Promise<UserEntity | null> {
    const trimmed = teacherPublicId.trim();
    if (!trimmed) {
      return null;
    }
    return this.userRepository.findOne({ where: { teacher_public_id: trimmed } });
  }

  async findByStudentPublicId(studentPublicId: string): Promise<UserEntity | null> {
    const trimmed = studentPublicId.trim();
    if (!trimmed) {
      return null;
    }
    return this.userRepository.findOne({ where: { student_public_id: trimmed } });
  }

  /**
   * Resolve a human-facing search value to a user:
   * email → phone → teacher public ID → student public ID.
   */
  async findByContactOrPublicId(raw: string): Promise<UserEntity | null> {
    const trimmed = raw.trim();
    if (!trimmed) {
      return null;
    }

    if (trimmed.includes('@')) {
      const email = normalizeEmail(trimmed);
      return email ? this.findByEmail(email) : null;
    }

    const byTeacher = await this.findByTeacherPublicId(trimmed);
    if (byTeacher) {
      return byTeacher;
    }

    const byStudent = await this.findByStudentPublicId(trimmed);
    if (byStudent) {
      return byStudent;
    }

    const phone = normalizePhone(trimmed);
    if (phone) {
      return this.findByPhone(phone);
    }

    return null;
  }

  async updatePassword(userId: string, newPassword: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.password = await this.crypto.hashPassword(newPassword);
    await this.userRepository.save(user);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isCurrentPasswordValid = await this.crypto.comparePassword(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    const isSamePassword = await this.crypto.comparePassword(newPassword, user.password);
    if (isSamePassword) {
      throw new BadRequestException('New password must be different from the current password');
    }

    user.password = await this.crypto.hashPassword(newPassword);
    await this.userRepository.save(user);
  }

  async getUserFromValidRefreshToken(refreshToken: string): Promise<UserEntity> {
    const verification = this.refreshTokenUtil.verify(refreshToken);
    if (!verification.valid || verification.expired) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.userRepository.findOne({
      where: { refresh_token: this.refreshTokenUtil.hash(refreshToken) },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (user.is_active === ActiveStatusEnum.INACTIVE) {
      throw new UnauthorizedException('Your account has been disabled. Please contact support.');
    }

    return user;
  }

  async refreshAccessToken(
    refreshToken: string,
    organizationId?: string | null,
  ): Promise<UserReponseDto> {
    // Validate the signature/expiry before touching the database.
    const verification = this.refreshTokenUtil.verify(refreshToken);
    if (!verification.valid || verification.expired) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Look up by the stored hash — plaintext tokens are never persisted.
    const user = await this.userRepository.findOne({
      where: { refresh_token: this.refreshTokenUtil.hash(refreshToken) },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (user.is_active === ActiveStatusEnum.INACTIVE) {
      throw new UnauthorizedException('Your account has been disabled. Please contact support.');
    }

    if (!organizationId) {
      return this.generateTokenForUser(user, null);
    }

    // Organization session refresh is handled by AuthService (needs OrganizationsService).
    // Fallback: individual token if caller forgot org context.
    return this.generateTokenForUser(user, null);
  }

  /**
   * Refresh while preserving an organization session (membership re-checked by AuthService).
   */
  async refreshAccessTokenWithOrg(
    refreshToken: string,
    orgSession: {
      organization_id: string;
      organization_number: number;
      member_role: string;
      organization_name: string;
      organization_status: string;
    },
  ): Promise<UserReponseDto> {
    const verification = this.refreshTokenUtil.verify(refreshToken);
    if (!verification.valid || verification.expired) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.userRepository.findOne({
      where: { refresh_token: this.refreshTokenUtil.hash(refreshToken) },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (user.is_active === ActiveStatusEnum.INACTIVE) {
      throw new UnauthorizedException('Your account has been disabled. Please contact support.');
    }

    return this.generateTokenForUser(user, orgSession);
  }

  async getProfile(userId: string) {
    const user = await this.findById(userId);

    return {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      personal_teacher_enabled: Boolean(user.personal_teacher_enabled),
      public_id: user.public_id ?? null,
      teacher_public_id: user.teacher_public_id ?? null,
      student_public_id: user.student_public_id ?? null,
      is_verified: user.is_verified,
      is_otp_verified: user.is_otp_verified,
      is_active: user.is_active,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
  }

  async verifyUserByPhone(phone: string): Promise<UserEntity> {
    const user = await this.userRepository.findOne({
      where: { phone },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    user.is_otp_verified = true;
    user.is_verified = true;
    
    return await this.userRepository.save(user);
  }

  async deleteUnverifiedUser(phone: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { phone },
    });

    if (user && !user.is_otp_verified) {
      await this.userRepository.remove(user);
    }
  }

  async listUsersForAdmin(
    query: ListUsersQueryDto,
  ): Promise<{ users: UserEntity[]; meta: AdminUserListMeta }> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(50, Math.max(1, query.limit ?? 20));
    const search = query.search?.trim();

    const qb = this.userRepository
      .createQueryBuilder('user')
      .select([
        'user.id',
        'user.full_name',
        'user.email',
        'user.phone',
        'user.role',
        'user.is_active',
        'user.is_verified',
        'user.is_otp_verified',
        'user.created_at',
      ])
      .orderBy('user.created_at', 'DESC');

    if (search) {
      const term = `%${search}%`;
      qb.andWhere(
        new Brackets((where) => {
          where
            .where('user.full_name ILIKE :term', { term })
            .orWhere('user.phone ILIKE :term', { term })
            .orWhere('user.email ILIKE :term', { term });
        }),
      );
    }

    const [users, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      users,
      meta: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async updateUserRole(
    adminId: string,
    userId: string,
    role: RolesEnum.STUDENT | RolesEnum.TEACHER,
  ): Promise<AdminUserSummary> {
    if (adminId === userId) {
      throw new ForbiddenException('You cannot change your own role');
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role === RolesEnum.ADMIN || user.role === RolesEnum.SUPER_ADMIN) {
      throw new ForbiddenException('Cannot change role for admin users');
    }

    if (user.role !== RolesEnum.STUDENT && user.role !== RolesEnum.TEACHER) {
      throw new BadRequestException('Only student and teacher roles can be updated');
    }

    if (user.role === role) {
      return {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        is_active: user.is_active,
        is_verified: user.is_verified,
        is_otp_verified: user.is_otp_verified,
        created_at: user.created_at,
      };
    }

    user.role = role;
    if (role === RolesEnum.TEACHER) {
      user.personal_teacher_enabled = true;
      if (!user.teacher_public_id) {
        user.teacher_public_id = await this.publicIdService.nextTeacherPublicId();
      }
    }
    const savedUser = await this.userRepository.save(user);

    if (role === RolesEnum.TEACHER) {
      try {
        await this.subscriptionService.provisionFreePlan(savedUser.id, savedUser.full_name ?? 'Teacher');
      } catch (error) {
        this.logger.error(
          `Failed to provision free subscription after role promotion: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return {
      id: savedUser.id,
      full_name: savedUser.full_name,
      email: savedUser.email,
      phone: savedUser.phone,
      role: savedUser.role,
      is_active: savedUser.is_active,
      is_verified: savedUser.is_verified,
      is_otp_verified: savedUser.is_otp_verified,
      created_at: savedUser.created_at,
    };
  }
}
