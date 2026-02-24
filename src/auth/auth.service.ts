import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { RegisterUserDto } from './dto/register-user.dto';
import { UserService } from 'src/user/user.service';
import { SmsService } from 'src/sms/sms.service';
import { UserReponseDto } from 'src/user/dto/user-response.dto';
import { VerifyOtpDto } from 'src/sms/dto/sms.dto';
import { RequestLoginOtpDto, VerifyLoginOtpDto } from './dto/login-otp.dto';
import { RolesEnum } from 'src/common/enums/roles.enum';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly smsService: SmsService,
  ) {}

  async signUp(registerUserDto: RegisterUserDto) {
    // Phone is required for registration
    if (!registerUserDto.phone) {
      throw new BadRequestException('Phone number is required for registration');
    }

    // Set default role if not provided
    if (!registerUserDto.role) {
      registerUserDto.role = RolesEnum.STUDENT;
    }

    // Send OTP using centralized SMS service
    const smsResult = await this.smsService.sendOtp(registerUserDto.phone);
    if (!smsResult.success) {
      throw new BadRequestException(`Failed to send OTP: ${smsResult.message}`);
    }

    // Create user (unverified until OTP is verified)
    await this.userService.create({ ...registerUserDto, is_verified: false });

    return {
      success: true,
      message: 'Registration successful. Please verify your phone number with the OTP sent.',
      data: {
        phone: registerUserDto.phone,
        email: registerUserDto.email,
        otpSent: true,
        requiresPhoneVerification: true,
      },
    };
  }

  async verifyPhoneForRegistration(verifyOtpDto: VerifyOtpDto) {
    const phone = verifyOtpDto.phone;

    const user = await this.userService.findByPhone(phone);
    if (!user) {
      throw new NotFoundException('No user found with this phone number');
    }

    // Verify OTP using centralized SMS service
    const verifyResult = await this.smsService.verifyOtp(phone, verifyOtpDto.otp);
    if (!verifyResult.success) {
      throw new BadRequestException(verifyResult.message);
    }

    await this.userService.verifyUserByPhone(phone);

    return {
      success: true,
      message: 'Phone verified successfully. You can now login.',
      data: {
        phone,
        phoneVerified: true,
      },
    };
  }

  async requestLoginOtp(requestLoginOtpDto: RequestLoginOtpDto) {
    const { phone, email } = requestLoginOtpDto;

    if (!phone && !email) {
      throw new BadRequestException('Either phone or email must be provided');
    }

    // Find user by phone or email
    let user;
    if (phone) {
      user = await this.userService.findByPhone(phone);
      if (!user) {
        throw new NotFoundException('No user found with this phone number');
      }
      // Send OTP using centralized SMS service
      const smsResult = await this.smsService.sendOtp(phone);
      if (!smsResult.success) {
        throw new BadRequestException(`Failed to send OTP: ${smsResult.message}`);
      }
      return {
        success: true,
        message: 'OTP sent successfully to your phone number',
        data: {
          phone,
          otpSent: true,
        },
      };
    } else if (email) {
      user = await this.userService.findByEmail(email);
      if (!user) {
        throw new NotFoundException('No user found with this email address');
      }
      if (!user.phone) {
        throw new BadRequestException('User does not have a phone number. Please contact support.');
      }
      // Send OTP using centralized SMS service
      const smsResult = await this.smsService.sendOtp(user.phone);
      if (!smsResult.success) {
        throw new BadRequestException(`Failed to send OTP: ${smsResult.message}`);
      }
      return {
        success: true,
        message: 'OTP sent successfully to your registered phone number',
        data: {
          email,
          phone: user.phone,
          otpSent: true,
        },
      };
    }
  }

  async verifyLoginOtp(verifyLoginOtpDto: VerifyLoginOtpDto): Promise<UserReponseDto> {
    const { phone, email, otp } = verifyLoginOtpDto;

    if (!phone && !email) {
      throw new BadRequestException('Either phone or email must be provided');
    }

    // Find user by phone or email
    let user;
    let phoneNumber: string;

    if (phone) {
      user = await this.userService.findByPhone(phone);
      if (!user) {
        throw new NotFoundException('No user found with this phone number');
      }
      phoneNumber = phone;
    } else if (email) {
      user = await this.userService.findByEmail(email);
      if (!user) {
        throw new NotFoundException('No user found with this email address');
      }
      if (!user.phone) {
        throw new BadRequestException('User does not have a phone number. Please contact support.');
      }
      phoneNumber = user.phone;
    }

    // Check if user is verified
    if (!user.is_verified) {
      throw new BadRequestException('Please verify your phone number before logging in');
    }

    // Verify OTP using centralized SMS service
    const verifyResult = await this.smsService.verifyOtp(phoneNumber, otp);
    if (!verifyResult.success) {
      throw new BadRequestException(verifyResult.message);
    }

    // Generate JWT token and return user data
    return await this.userService.generateTokenForUser(user);
  }
}
