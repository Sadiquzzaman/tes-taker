import { BadRequestException, Injectable } from '@nestjs/common';
import { RegisterUserDto } from './dto/register-user.dto';
import { UserService } from 'src/user/user.service';
import { SmsService } from 'src/sms/sms.service';
import { LocalAuthUserDto } from './dto/local-auth-user.dto';
import { UserReponseDto } from 'src/user/dto/user-response.dto';
import { VerifyOtpDto } from 'src/sms/dto/sms.dto';
import { ResetForgottenPasswordDto, ResetPasswordDto } from './dto/password.dto';
import { RolesEnum } from 'src/common/enums/roles.enum';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly smsService: SmsService,
  ) {}

  async signUp(registerUserDto: RegisterUserDto) {
    // Validate confirm password matches password
    if (registerUserDto.password !== registerUserDto.confirm_password) {
      throw new BadRequestException('Password and confirm password do not match');
    }

    // Validate at least one of email or phone is provided
    if (!registerUserDto.email && !registerUserDto.phone) {
      throw new BadRequestException('Either email or phone must be provided');
    }

    // Set default role if not provided
    if (!registerUserDto.role) {
      registerUserDto.role = RolesEnum.STUDENT;
    }

    // If phone is provided, send OTP
    if (registerUserDto.phone) {
      const smsResult = await this.smsService.sendOtp(registerUserDto.phone);
      if (!smsResult.success) {
        throw new BadRequestException(`Failed to send OTP: ${smsResult.message}`);
      }
    }

    // Create user (set is_verified based on whether phone verification is needed)
    const isVerified = !registerUserDto.phone; // If only email, mark as verified
    await this.userService.create({ ...registerUserDto, is_verified: isVerified });

    return {
      success: true,
      message: registerUserDto.phone 
        ? 'Registration successful. Please verify your phone number with the OTP sent.'
        : 'Registration successful. You can now login.',
      data: {
        phone: registerUserDto.phone,
        email: registerUserDto.email,
        otpSent: !!registerUserDto.phone,
        requiresPhoneVerification: !!registerUserDto.phone,
      },
    };
  }

  async validateLocalStrategyUser(
    localUser: LocalAuthUserDto,
  ): Promise<UserReponseDto> {
    return await this.userService.validateUserEmailPass(localUser);
  }

  async verifyPhoneForRegistration(verifyOtpDto: VerifyOtpDto) {
    const phone = verifyOtpDto.phone;

    const user = await this.userService.findByPhone(phone);
    if (!user) {
      throw new BadRequestException('No user found with this phone number');
    }

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

  async forgetPassword(phone: string) {
    const user = await this.userService.findByPhone(phone);
    if (!user) {
      throw new BadRequestException('No user found with this phone number');
    }

    const smsResult = await this.smsService.sendOtp(phone);
    if (!smsResult.success) {
      throw new Error(`Failed to send OTP: ${smsResult.message}`);
    }

    return {
      success: true,
      phone,
      otpSent: true,
    };
  }

  async resetForgottenPassword(dto: ResetForgottenPasswordDto) {
    const { phone, otp, newPassword, confirmNewPassword } = dto;

    if (newPassword !== confirmNewPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const verifyResult = await this.smsService.verifyOtp(phone, otp);
    if (!verifyResult.success) {
      throw new BadRequestException('Invalid OTP');
    }

    const updatedUser = await this.userService.updatePasswordByPhone(phone, newPassword);

    return {
      success: true,
      phone,
      passwordUpdated: true,
      userId: updatedUser.id,
    };
  }

  async resetPassword(userId: string, dto: ResetPasswordDto) {
    const { oldPassword, newPassword, confirmNewPassword } = dto;

    if (newPassword !== confirmNewPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const updatedUser = await this.userService.updatePasswordByOldPassword(userId, oldPassword, newPassword);

    return {
      success: true,
      userId: updatedUser.id,
      passwordUpdated: true,
    };
  }
}
