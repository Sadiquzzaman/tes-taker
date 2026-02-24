import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { RegisterUserDto } from 'src/auth/dto/register-user.dto';
import { ActiveStatusEnum } from 'src/common/enums/active-status.enum';
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

      if (isEmailDuplicate) {
        throw new BadRequestException('Email already exists!');
      }
    }

    // Check for duplicate phone
    const isPhoneDuplicate = await this.userRepository.findOne({
      where: { phone: registerUserDto.phone },
    });

    if (isPhoneDuplicate) {
      throw new BadRequestException('Phone number already exists!');
    }

    const verificationToken = this.generateVerificationToken();
    const refreshToken = (Math.random() * 0xfffff * 1000000).toString(16);
    
    const userEntity = {
      ...registerUserDto,
      verification_token: verificationToken,
      is_active: registerUserDto.is_active || ActiveStatusEnum.ACTIVE,
      refresh_token: refreshToken,
      is_verified: registerUserDto.is_verified || false,
      created_at: new Date(),
    };

    const user = await this.userRepository.save(userEntity);
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

  private generateJwtToken(user: UserEntity): string {
    const payload = {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
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

    user.is_verified = true;
    
    return await this.userRepository.save(user);
  }
}
