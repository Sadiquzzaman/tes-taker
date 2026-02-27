import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { RegisterUserDto } from 'src/auth/dto/register-user.dto';
import { LoginDto } from 'src/auth/dto/login.dto';
import { ActiveStatusEnum } from 'src/common/enums/active-status.enum';
import { CryptoUtil } from 'src/common/utils/crypto.util';
import { UserFilterUtil } from 'src/common/utils/user-filter.util';
import { Repository } from 'typeorm';
import { UserReponseDto } from './dto/user-response.dto';
import { UserEntity } from './entities/user.entity';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly crypto: CryptoUtil,
    private readonly userFilterUtil: UserFilterUtil,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
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
    const refreshToken = (Math.random() * 0xfffff * 1000000).toString(16);
    
    const userEntity = {
      ...registerUserDto,
      verification_token: verificationToken,
      is_active: registerUserDto.is_active || ActiveStatusEnum.ACTIVE,
      refresh_token: refreshToken,
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

  async generateTokenForUser(user: UserEntity): Promise<UserReponseDto> {
    // Generate JWT token
    const access_token = this.generateJwtToken(user);

    // Update refresh token
    const refreshToken = (Math.random() * 0xfffff * 1000000).toString(16);
    user.refresh_token = refreshToken;
    await user.save();

    return { ...user, access_token };
  }

  async validateUserEmailPass(loginDto: LoginDto): Promise<UserReponseDto> {
    // Check if user is trying to login with email or phone
    let user: UserEntity | null;
    
    if (loginDto.email && loginDto.email.includes('@')) {
      // Login with email
      user = await this.userRepository.findOne({
        where: { email: loginDto.email },
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
}
