import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { RegisterUserDto } from './dto/register-user.dto';
import { LoginDto } from './dto/login.dto';
import { UserService } from 'src/user/user.service';
import { SmsService } from 'src/sms/sms.service';
import { ClassService } from 'src/classes/class.service';
import { UserReponseDto } from 'src/user/dto/user-response.dto';
import { VerifyOtpDto } from 'src/sms/dto/sms.dto';
import { RolesEnum } from 'src/common/enums/roles.enum';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly smsService: SmsService,
    private readonly classService: ClassService,
  ) {}

  async signUp(registerUserDto: RegisterUserDto) {
    // Validate confirm password matches password
    if (registerUserDto.password !== registerUserDto.confirm_password) {
      throw new BadRequestException('Password and confirm password do not match');
    }

    // Phone is required for registration
    if (!registerUserDto.phone) {
      throw new BadRequestException('Phone number is required for registration');
    }

    // Set default role if not provided
    if (!registerUserDto.role) {
      registerUserDto.role = RolesEnum.STUDENT;
    }

    // Check if user with this phone already exists
    const existingUser = await this.userService.findByPhone(registerUserDto.phone);
    
    if (existingUser) {
      if (existingUser.is_otp_verified) {
        throw new BadRequestException('Phone number already registered and verified');
      } else {
        // Delete unverified user to allow re-registration
        await this.userService.deleteUnverifiedUser(registerUserDto.phone);
      }
    }

    // Check for duplicate email if provided (only if verified)
    if (registerUserDto.email) {
      const existingEmailUser = await this.userService.findByEmail(registerUserDto.email);
      if (existingEmailUser && existingEmailUser.is_otp_verified) {
        throw new BadRequestException('Email already exists and verified');
      }
    }

    // Send OTP using centralized SMS service
    const smsResult = await this.smsService.sendOtp(registerUserDto.phone);
    if (!smsResult.success) {
      throw new BadRequestException(`Failed to send OTP: ${smsResult.message}`);
    }

    // Create user (unverified until OTP is verified)
    await this.userService.create({ 
      ...registerUserDto, 
      is_otp_verified: false,
      is_verified: false 
    });

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

  async verifyPhoneForRegistration(verifyOtpDto: VerifyOtpDto, classInvitationToken?: string) {
    const phone = verifyOtpDto.phone;

    const user = await this.userService.findByPhone(phone);
    if (!user) {
      throw new NotFoundException('No user found with this phone number');
    }

    // Check if already verified
    if (user.is_otp_verified) {
      throw new BadRequestException('Phone number already verified');
    }

    // Verify OTP using centralized SMS service
    const verifyResult = await this.smsService.verifyOtp(phone, verifyOtpDto.otp);
    if (!verifyResult.success) {
      throw new BadRequestException(verifyResult.message);
    }

    await this.userService.verifyUserByPhone(phone);

    // Handle class invitation if provided (classInvitationToken is actually classId)
    if (classInvitationToken) {
      try {
        await this.classService.handleClassInvitation(
          classInvitationToken,
          user.id,
          phone,
          user.email,
        );
      } catch (error) {
        // Log error but don't fail registration
        console.error('Failed to handle class invitation:', error);
      }
    }

    return {
      success: true,
      message: 'Phone verified successfully. You can now login.',
      data: {
        phone,
        phoneVerified: true,
        classJoined: !!classInvitationToken,
      },
    };
  }

  async login(loginDto: LoginDto): Promise<UserReponseDto> {
    return await this.userService.validateUserEmailPass(loginDto);
  }
}
