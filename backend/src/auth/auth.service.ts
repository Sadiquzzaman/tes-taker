import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { RegisterUserDto } from './dto/register-user.dto';
import { RegisterOrganizationDto } from './dto/register-organization.dto';
import { LoginDto } from './dto/login.dto';
import { LoginOrganizationDto } from './dto/login-organization.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyResetOtpDto } from './dto/verify-reset-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UserService } from 'src/user/user.service';
import { SmsService } from 'src/sms/sms.service';
import { SmsRateLimitService } from 'src/sms/sms-rate-limit.service';
import { EmailService } from 'src/email/email.service';
import { ClassService } from 'src/classes/class.service';
import { SubscriptionService } from 'src/subscriptions/subscription.service';
import { OrganizationsService } from 'src/organizations/organization.service';
import { UserContextService } from 'src/organizations/user-context.service';
import { TeacherRequestService } from 'src/teacher-requests/teacher-request.service';
import { SelectableContextTypeEnum } from 'src/organizations/dto/select-context.dto';
import { UserReponseDto } from 'src/user/dto/user-response.dto';
import { VerifyOtpDto } from 'src/sms/dto/sms.dto';
import { RolesEnum } from 'src/common/enums/roles.enum';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly userService: UserService,
    private readonly smsService: SmsService,
    private readonly smsRateLimitService: SmsRateLimitService,
    private readonly emailService: EmailService,
    private readonly classService: ClassService,
    private readonly subscriptionService: SubscriptionService,
    private readonly organizationsService: OrganizationsService,
    private readonly userContextService: UserContextService,
    private readonly teacherRequestService: TeacherRequestService,
  ) {}

  async signUp(registerUserDto: RegisterUserDto) {
    // Validate confirm password matches password
    if (registerUserDto.password !== registerUserDto.confirm_password) {
      throw new BadRequestException('Password and confirm password do not match');
    }

    // Phone and email are required for registration
    if (!registerUserDto.phone) {
      throw new BadRequestException('Phone number is required for registration');
    }
    if (!registerUserDto.email) {
      throw new BadRequestException('Email is required for registration');
    }

    // Self-service registration always creates a student account.
    // Teacher signup only queues a pending teacher request for admin review.
    const requestTeacher = Boolean(registerUserDto.request_teacher);
    registerUserDto.role = RolesEnum.STUDENT;
    registerUserDto.request_teacher = undefined;

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

    // Check for duplicate email (only if verified)
    const existingEmailUser = await this.userService.findByEmail(registerUserDto.email);
    if (existingEmailUser && existingEmailUser.is_otp_verified) {
      throw new BadRequestException('Email already exists and verified');
    }

    // Send OTP using centralized SMS service
    const smsResult = await this.smsService.sendOtp(registerUserDto.phone);
    if (!smsResult.success) {
      throw new BadRequestException(`Failed to send OTP: ${smsResult.message}`);
    }

    // Create user (unverified until OTP is verified)
    const user = await this.userService.create({ 
      ...registerUserDto, 
      is_otp_verified: false,
      is_verified: false 
    });

    let teacherRequestCreated = false;
    if (requestTeacher) {
      await this.teacherRequestService.createRequest(user.id, {
        note: 'Created during teacher signup',
      });
      teacherRequestCreated = true;
    }

    return {
      success: true,
      message: teacherRequestCreated
        ? 'Registration successful. Verify your phone with the OTP. Your teacher request is pending admin approval.'
        : 'Registration successful. Please verify your phone number with the OTP sent.',
      data: {
        phone: registerUserDto.phone,
        email: registerUserDto.email,
        otpSent: true,
        requiresPhoneVerification: true,
        teacher_request_created: teacherRequestCreated,
      },
    };
  }

  /**
   * Organization owner registration. Creates an unverified TEACHER user,
   * stores the org name in Redis, and sends OTP. Organization + OWNER membership
   * are created on OTP verification (status PENDING until SUPER_ADMIN approval).
   */
  async registerOrganization(dto: RegisterOrganizationDto) {
    if (dto.password !== dto.confirm_password) {
      throw new BadRequestException('Password and confirm password do not match');
    }

    if (!dto.phone) {
      throw new BadRequestException('Phone number is required for registration');
    }
    if (!dto.email) {
      throw new BadRequestException('Email is required for registration');
    }

    const organizationName = dto.organization_name?.trim();
    if (!organizationName) {
      throw new BadRequestException('Organization name is required');
    }

    const existingUser = await this.userService.findByPhone(dto.phone);
    if (existingUser) {
      if (existingUser.is_otp_verified) {
        throw new BadRequestException('Phone number already registered and verified');
      }
      await this.userService.deleteUnverifiedUser(dto.phone);
      await this.organizationsService.clearPendingOrgName(dto.phone);
    }

    const existingEmailUser = await this.userService.findByEmail(dto.email);
    if (existingEmailUser && existingEmailUser.is_otp_verified) {
      throw new BadRequestException('Email already exists and verified');
    }

    const smsResult = await this.smsService.sendOtp(dto.phone);
    if (!smsResult.success) {
      throw new BadRequestException(`Failed to send OTP: ${smsResult.message}`);
    }

    await this.organizationsService.storePendingOrgName(dto.phone, organizationName);

    await this.userService.create({
      full_name: dto.full_name,
      phone: dto.phone,
      email: dto.email,
      password: dto.password,
      confirm_password: dto.confirm_password,
      role: RolesEnum.TEACHER,
      // Org owners are teacher-capable for RolesGuard, but do NOT get personal teaching workspace.
      personal_teacher_enabled: false,
      ensure_teacher_public_id: true,
      is_otp_verified: false,
      is_verified: false,
    });

    return {
      success: true,
      message:
        'Organization registration started. Please verify your phone number with the OTP sent. Your organization will remain pending until approved.',
      data: {
        phone: dto.phone,
        email: dto.email,
        organization_name: organizationName,
        otpSent: true,
        requiresPhoneVerification: true,
        requiresOrganizationApproval: true,
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

    const pendingOrgName = await this.organizationsService.consumePendingOrgName(phone);

    await this.userService.verifyUserByPhone(phone);

    let organizationCreated: {
      id: string;
      name: string;
      organization_number: number;
      status: string;
    } | null = null;
    if (pendingOrgName) {
      try {
        const organization = await this.organizationsService.createPendingFromRegistration({
          organizationName: pendingOrgName,
          ownerUserId: user.id,
          ownerFullName: user.full_name,
        });
        organizationCreated = {
          id: organization.id,
          name: organization.name,
          organization_number: Number(organization.organization_number),
          status: organization.status,
        };
      } catch (error) {
        this.logger.error(
          `Failed to create pending organization: ${error instanceof Error ? error.message : String(error)}`,
          error instanceof Error ? error.stack : undefined,
        );
        throw new BadRequestException('Phone verified but organization could not be created. Please contact support.');
      }
    }

    // Only provision personal teacher subscription when personal teacher context is enabled.
    // Organization-only teachers/owners must not get a personal teaching workspace automatically.
    const verifiedUser = await this.userService.findByPhone(phone);
    if (verifiedUser?.personal_teacher_enabled) {
      try {
        await this.subscriptionService.provisionFreePlan(
          verifiedUser.id,
          verifiedUser.full_name ?? 'Teacher',
        );
      } catch (error) {
        this.logger.error(
          `Failed to provision free subscription: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

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
        this.logger.error(
          `Failed to handle class invitation: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    try {
      await this.organizationsService.acceptPendingInvitationsForUser({
        userId: user.id,
        phone,
        email: user.email,
      });
    } catch (error) {
      this.logger.error(
        `Failed to accept organization invitations: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return {
      success: true,
      message: organizationCreated
        ? 'Phone verified successfully. Your organization is pending approval. You can login.'
        : 'Phone verified successfully. You can now login.',
      data: {
        phone,
        phoneVerified: true,
        classJoined: !!classInvitationToken,
        organization: organizationCreated,
      },
    };
  }

  async login(loginDto: LoginDto): Promise<UserReponseDto & { contexts: unknown[]; requires_context_selection: boolean }> {
    const user = await this.userService.assertLoginCredentials(loginDto);

    try {
      await this.organizationsService.acceptPendingInvitationsForUser({
        userId: user.id,
        phone: user.phone,
        email: user.email,
      });
    } catch (error) {
      this.logger.error(
        `Failed to accept organization invitations on login: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const contexts = await this.userContextService.listContexts(user.id);
    const actionable = contexts.filter((c) => c.actionable);

    // Single actionable context → enter it directly (no selection page).
    if (actionable.length === 1) {
      const only = actionable[0];
      if (only.type === 'organization' && only.organization_id) {
        const selected = await this.userContextService.selectContext(
          user.id,
          SelectableContextTypeEnum.ORGANIZATION,
          only.organization_id,
        );
        return { ...selected, requires_context_selection: false };
      }
      if (only.type === 'personal_teacher') {
        const selected = await this.userContextService.selectContext(
          user.id,
          SelectableContextTypeEnum.PERSONAL_TEACHER,
        );
        return { ...selected, requires_context_selection: false };
      }
      if (only.type === 'individual_teacher' && only.teacher_id) {
        const selected = await this.userContextService.selectContext(
          user.id,
          SelectableContextTypeEnum.INDIVIDUAL_TEACHER,
          undefined,
          only.teacher_id,
        );
        return { ...selected, requires_context_selection: false };
      }
    }

    // Multiple (or zero) contexts: land on dashboard; pick from dashboard/header.
    const token = await this.userService.generateTokenForUser(user, null, {
      context_type: 'individual',
    });
    return {
      ...token,
      contexts,
      requires_context_selection: false,
    };
  }

  async listContexts(userId: string) {
    return this.userContextService.listContexts(userId);
  }

  async selectContext(
    userId: string,
    type: SelectableContextTypeEnum,
    organizationId?: string,
    teacherId?: string,
  ) {
    return this.userContextService.selectContext(userId, type, organizationId, teacherId);
  }

  async loginOrganization(dto: LoginOrganizationDto): Promise<UserReponseDto & { contexts: unknown[] }> {
    const user = await this.userService.assertLoginCredentials({
      phone: dto.phone,
      password: dto.password,
    });

    const { organization, membership } =
      await this.organizationsService.findMembershipForLogin(
        dto.organization_number,
        user.id,
      );

    const token = await this.userService.generateTokenForUser(user, {
      organization_id: organization.id,
      organization_number: Number(organization.organization_number),
      member_role: membership.role,
      organization_name: organization.name,
      organization_status: organization.status,
    }, {
      context_type: 'organization',
    });

    const contexts = await this.userContextService.listContexts(user.id);
    return { ...token, contexts };
  }

  async refreshToken(refreshToken: string, organizationId?: string): Promise<UserReponseDto> {
    if (!organizationId) {
      return this.userService.refreshAccessToken(refreshToken);
    }

    const user = await this.userService.getUserFromValidRefreshToken(refreshToken);
    const { organization, membership } =
      await this.organizationsService.findMembershipByOrgId(organizationId, user.id);

    return this.userService.refreshAccessTokenWithOrg(refreshToken, {
      organization_id: organization.id,
      organization_number: Number(organization.organization_number),
      member_role: membership.role,
      organization_name: organization.name,
      organization_status: organization.status,
    });
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
    const isEmailIdentifier = identifier.includes('@');

    const user = await this.userService.findByPhoneOrEmail(identifier);
    if (!user) {
      throw new NotFoundException('No account found with this phone number or email');
    }

    // Generate and store OTP keyed by the identifier the user provided
    const otp = this.smsService.generateOtp();
    await this.smsRateLimitService.storePasswordResetOtp(identifier, otp);

    // Log the OTP only outside production so it can be used during local
    // development/testing. Never expose secrets in production logs.
    if (process.env.NODE_ENV !== 'production') {
      this.logger.debug(`[Password Reset OTP] identifier: ${identifier} | otp: ${otp}`);
    }

    if (isEmailIdentifier) {
      if (!user.email) {
        throw new BadRequestException('This account does not have an email address on file');
      }
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
        this.logger.error(
          `Failed to send password reset OTP via email: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw new BadRequestException('Failed to send password reset code via email. Please try again.');
      }

      return {
        success: true,
        message: 'A password reset code has been sent to your email.',
        data: {
          identifier,
          channel: 'email' as const,
          otpSent: true,
          maskedPhone: null,
          maskedEmail: user.email ? this.maskEmail(user.email) : null,
        },
      };
    }

    if (!user.phone) {
      throw new BadRequestException('This account does not have a phone number on file');
    }

    const message = `Your TestTaker password reset OTP is: ${otp}. Valid for 5 minutes.`;
    try {
      await this.smsService.sendSms(user.phone, message);
    } catch (error) {
      this.logger.error(
        `Failed to send password reset OTP via SMS: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new BadRequestException('Failed to send password reset code via SMS. Please try again.');
    }

    return {
      success: true,
      message: 'A password reset code has been sent to your phone.',
      data: {
        identifier,
        channel: 'sms' as const,
        otpSent: true,
        maskedPhone: this.maskPhone(user.phone),
        maskedEmail: null,
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
