import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
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
import { Brackets, Repository } from 'typeorm';
import { UserReponseDto } from './dto/user-response.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UserEntity } from './entities/user.entity';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';

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
export class UserService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly crypto: CryptoUtil,
    private readonly refreshTokenUtil: RefreshTokenUtil,
    private readonly userFilterUtil: UserFilterUtil,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

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

    const userEntity = {
      ...registerUserDto,
      verification_token: verificationToken,
      is_active: registerUserDto.is_active || ActiveStatusEnum.ACTIVE,
      refresh_token: refreshTokenHash,
      is_otp_verified: registerUserDto.is_otp_verified || false,
      is_verified: registerUserDto.is_verified || false,
      created_at: new Date(),
    };

    const user = await this.userRepository.save(userEntity);
    delete user.password;
    return user;
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

  async generateTokenForUser(user: UserEntity): Promise<UserReponseDto> {
    // Generate JWT token
    const access_token = this.generateJwtToken(user);

    // Rotate the refresh token: a new opaque token is issued to the client and
    // only its hash is stored, so a stolen/leaked DB row cannot be replayed.
    const { token, hash } = this.refreshTokenUtil.generate();
    user.refresh_token = hash;
    await user.save();

    return { ...user, access_token, refresh_token: token };
  }

  async validateUserEmailPass(loginDto: LoginDto): Promise<UserReponseDto> {
    // Check if user is trying to login with email or phone
    let user: UserEntity | null;
    
    if (loginDto.email && loginDto.email.includes('@')) {
      // Login with email
      user = await this.userRepository.findOne({
        where: { email: loginDto.email.trim().toLowerCase() },
      });
    } else if (loginDto.phone) {
      // Login with phone
      user = await this.userRepository.findOne({
        where: { phone: loginDto.phone },
      });
    } else {
      throw new UnauthorizedException('Invalid login credentials');
    }

    if (!user) {
      throw new UnauthorizedException('Invalid login credentials');
    }

    // Verify password
    if (!(await this.crypto.comparePassword(loginDto.password, user.password))) {
      throw new UnauthorizedException('Invalid login credentials');
    }

    // Check if user is verified (OTP verified)
    if (!user.is_otp_verified || !user.is_verified) {
      throw new UnauthorizedException('Please verify your phone number with OTP before logging in');
    }

    if (user.is_active === ActiveStatusEnum.INACTIVE) {
      throw new UnauthorizedException('Your account has been disabled. Please contact support.');
    }

    // Generate token
    return await this.generateTokenForUser(user);
  }

  private generateJwtToken(user: UserEntity): string {
    const payload = {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      phone: user.phone
    };

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

  async refreshAccessToken(refreshToken: string): Promise<UserReponseDto> {
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

    return this.generateTokenForUser(user);
  }

  async getProfile(userId: string) {
    const user = await this.findById(userId);

    return {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      phone: user.phone,
      role: user.role,
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
    const savedUser = await this.userRepository.save(user);

    if (role === RolesEnum.TEACHER) {
      try {
        await this.subscriptionService.provisionFreePlan(savedUser.id, savedUser.full_name ?? 'Teacher');
      } catch (error) {
        console.error('Failed to provision free subscription after role promotion:', error);
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
