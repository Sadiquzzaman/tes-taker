import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { RegisterUserDto } from './dto/register-user.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyResetOtpDto } from './dto/verify-reset-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UserService } from 'src/user/user.service';
import { SmsService } from 'src/sms/sms.service';
import { SmsRateLimitService } from 'src/sms/sms-rate-limit.service';
import { EmailService } from 'src/email/email.service';
import { ClassService } from 'src/classes/class.service';
import { UserReponseDto } from 'src/user/dto/user-response.dto';
import { VerifyOtpDto } from 'src/sms/dto/sms.dto';
import { RolesEnum } from 'src/common/enums/roles.enum';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly smsService: SmsService,
    private readonly smsRateLimitService: SmsRateLimitService,
    private readonly emailService: EmailService,
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

  async getProfile(userId: string) {
    return await this.userService.getProfile(userId);
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    if (changePasswordDto.new_password !== changePasswordDto.confirm_password) {
      throw new BadRequestException('New password and confirm password do not match');
    }

    await this.userService.changePassword(
      userId,
      changePasswordDto.current_password,
      changePasswordDto.new_password,
    );

    return {
      success: true,
      message: 'Password changed successfully.',
      data: { passwordChanged: true },
    };
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const identifier = forgotPasswordDto.identifier.trim();

    const user = await this.userService.findByPhoneOrEmail(identifier);
    if (!user) {
      throw new NotFoundException('No account found with this phone number or email');
    }

    // Generate and store OTP keyed by the identifier the user provided
    const otp = this.smsService.generateOtp();
    await this.smsRateLimitService.storePasswordResetOtp(identifier, otp);

    // Always log the OTP so it can be used during local development/testing
    console.log(`[Password Reset OTP] identifier: ${identifier} | otp: ${otp}`);

    const message = `Your TestTaker password reset OTP is: ${otp}. Valid for 5 minutes.`;

    // Send OTP to the user's phone (SMS) when available
    if (user.phone) {
      try {
        await this.smsService.sendSms(user.phone, message);
      } catch (error) {
        console.error('Failed to send password reset OTP via SMS:', error);
      }
    }

    // Send OTP to the user's email when available
    if (user.email) {
      try {
        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #232A25;">Reset your TestTaker password</h2>
            <p>Hello ${user.full_name || ''},</p>
            <p>Use the verification code below to reset your password. This code is valid for 5 minutes.</p>
            <p style="margin: 24px 0;">
              <span style="display: inline-block; font-size: 28px; letter-spacing: 6px; font-weight: 700; color: #49734F;">${otp}</span>
            </p>
            <p style="color: #747775; font-size: 13px;">If you didn't request a password reset, you can safely ignore this email.</p>
          </div>
        `;
        await this.emailService.sendEmail(user.email, 'Reset your TestTaker password', html);
      } catch (error) {
        console.error('Failed to send password reset OTP via email:', error);
      }
    }

    return {
      success: true,
      message: 'A password reset code has been sent to your phone and email.',
      data: {
        identifier,
        otpSent: true,
        maskedPhone: user.phone ? this.maskPhone(user.phone) : null,
        maskedEmail: user.email ? this.maskEmail(user.email) : null,
      },
    };
  }

  async verifyResetOtp(verifyResetOtpDto: VerifyResetOtpDto) {
    const identifier = verifyResetOtpDto.identifier.trim();

    const storedOtp = await this.smsRateLimitService.getPasswordResetOtp(identifier);
    if (!storedOtp) {
      throw new BadRequestException('OTP expired or not found. Please request a new code.');
    }

    if (storedOtp !== verifyResetOtpDto.otp) {
      throw new BadRequestException('Invalid OTP. Please try again.');
    }

    return {
      success: true,
      message: 'OTP verified successfully. You can now set a new password.',
      data: { identifier, otpVerified: true },
    };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const identifier = resetPasswordDto.identifier.trim();

    if (resetPasswordDto.password !== resetPasswordDto.confirm_password) {
      throw new BadRequestException('Password and confirm password do not match');
    }

    const storedOtp = await this.smsRateLimitService.getPasswordResetOtp(identifier);
    if (!storedOtp) {
      throw new BadRequestException('OTP expired or not found. Please request a new code.');
    }

    if (storedOtp !== resetPasswordDto.otp) {
      throw new BadRequestException('Invalid OTP. Please try again.');
    }

    const user = await this.userService.findByPhoneOrEmail(identifier);
    if (!user) {
      throw new NotFoundException('No account found with this phone number or email');
    }

    await this.userService.updatePassword(user.id, resetPasswordDto.password);
    await this.smsRateLimitService.removePasswordResetOtp(identifier);

    return {
      success: true,
      message: 'Password reset successfully. You can now login with your new password.',
      data: { passwordReset: true },
    };
  }

  private maskPhone(phone: string): string {
    if (phone.length <= 4) {
      return phone;
    }
    return `${phone.slice(0, 3)}****${phone.slice(-2)}`;
  }

  private maskEmail(email: string): string {
    const [name, domain] = email.split('@');
    if (!domain) {
      return email;
    }
    const visible = name.slice(0, Math.min(2, name.length));
    return `${visible}${'*'.repeat(Math.max(1, name.length - visible.length))}@${domain}`;
  }
}
