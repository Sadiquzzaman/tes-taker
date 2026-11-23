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
import { NotificationsService } from 'src/notifications/notifications.service';
import { NOTIFICATION_EVENTS, NotificationChannelEnum } from 'src/notifications/notification.constants';
import { ClassService } from 'src/classes/class.service';
import { OrganizationsService } from 'src/organizations/organization.service';
import { UserContextService } from 'src/organizations/user-context.service';
import { TeacherRequestService } from 'src/teacher-requests/teacher-request.service';
import { SelectableContextTypeEnum } from 'src/organizations/dto/select-context.dto';
import { UserReponseDto } from 'src/user/dto/user-response.dto';
import { VerifyOtpDto } from 'src/sms/dto/sms.dto';
import { RolesEnum } from 'src/common/enums/roles.enum';
import { AUTH_ERRORS } from './auth-errors';
import { DeviceInfo, RefreshTokensService, SignedInDevice } from 'src/user/refresh-tokens.service';
import { RefreshTokenRevokeReasonEnum } from 'src/user/entities/refresh-token.entity';
import { AuditService } from 'src/audit/audit.service';
import { AUDIT_ACTIONS } from 'src/audit/audit-actions';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly userService: UserService,
    private readonly smsService: SmsService,
    private readonly smsRateLimitService: SmsRateLimitService,
    private readonly notifications: NotificationsService,
    private readonly classService: ClassService,
    private readonly organizationsService: OrganizationsService,
    private readonly userContextService: UserContextService,
    private readonly teacherRequestService: TeacherRequestService,
    private readonly refreshTokens: RefreshTokensService,
    private readonly audit: AuditService,
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
    // Academic or IELTS (P12-03, IEL-11): kept on the teacher request for the solo workspace.
    const workspaceType = registerUserDto.workspace_type === 'IELTS' ? 'IELTS' : 'ACADEMIC';
    registerUserDto.role = RolesEnum.STUDENT;
    registerUserDto.request_teacher = undefined;
    registerUserDto.workspace_type = undefined;

    // Check if user with this phone already exists
    const existingUser = await this.userService.findByPhone(registerUserDto.phone);
    
    if (existingUser) {
      if (existingUser.is_otp_verified) {
        throw new BadRequestException({ message: 'Phone number already registered and verified', code: AUTH_ERRORS.PHONE_ALREADY_REGISTERED });
      } else {
        // Delete unverified user to allow re-registration
        await this.userService.deleteUnverifiedUser(registerUserDto.phone);
      }
    }

    // Check for duplicate email (only if verified)
    const existingEmailUser = await this.userService.findByEmail(registerUserDto.email);
    if (existingEmailUser && existingEmailUser.is_otp_verified) {
      throw new BadRequestException({ message: 'Email already exists and verified', code: AUTH_ERRORS.EMAIL_ALREADY_REGISTERED });
    }

    // Send OTP using centralized SMS service
    const smsResult = await this.smsService.sendOtp(registerUserDto.phone);
    if (!smsResult.success) {
      throw new BadRequestException({ message: `Failed to send OTP: ${smsResult.message}`, code: AUTH_ERRORS.OTP_SEND_FAILED });
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
        workspace_type: workspaceType,
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
        throw new BadRequestException({ message: 'Phone number already registered and verified', code: AUTH_ERRORS.PHONE_ALREADY_REGISTERED });
      }
      await this.userService.deleteUnverifiedUser(dto.phone);
      await this.organizationsService.clearPendingOrgName(dto.phone);
    }

    const existingEmailUser = await this.userService.findByEmail(dto.email);
    if (existingEmailUser && existingEmailUser.is_otp_verified) {
      throw new BadRequestException({ message: 'Email already exists and verified', code: AUTH_ERRORS.EMAIL_ALREADY_REGISTERED });
    }

    const smsResult = await this.smsService.sendOtp(dto.phone);
    if (!smsResult.success) {
      throw new BadRequestException({ message: `Failed to send OTP: ${smsResult.message}`, code: AUTH_ERRORS.OTP_SEND_FAILED });
    }

    await this.organizationsService.storePendingOrgName(dto.phone, organizationName, dto.kind);

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
      throw new NotFoundException({ message: 'No user found with this phone number', code: AUTH_ERRORS.ACCOUNT_NOT_FOUND });
    }

    // Check if already verified
    if (user.is_otp_verified) {
      throw new BadRequestException({ message: 'Phone number already verified', code: AUTH_ERRORS.PHONE_ALREADY_VERIFIED });
    }

    // Verify OTP using centralized SMS service
    const verifyResult = await this.smsService.verifyOtp(phone, verifyOtpDto.otp);
    if (!verifyResult.success) {
      throw new BadRequestException({ message: verifyResult.message, code: verifyResult.expired ? AUTH_ERRORS.OTP_EXPIRED : AUTH_ERRORS.OTP_INVALID });
    }

    const pendingOrgName = await this.organizationsService.consumePendingOrgName(phone);
    const pendingOrgKind = await this.organizationsService.consumePendingOrgKind(phone);

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
          kind: pendingOrgKind,
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

    // No subscription is created at sign-up: a workspace without one is on the Free plan (P2-02).

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

  async login(loginDto: LoginDto, device?: DeviceInfo): Promise<UserReponseDto & { contexts: unknown[]; requires_context_selection: boolean }> {
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
          undefined,
          { device },
        );
        return { ...selected, requires_context_selection: false };
      }
      if (only.type === 'personal_teacher') {
        const selected = await this.userContextService.selectContext(
          user.id,
          SelectableContextTypeEnum.PERSONAL_TEACHER,
          undefined,
          undefined,
          { device },
        );
        return { ...selected, requires_context_selection: false };
      }
      if (only.type === 'individual_teacher' && only.teacher_id) {
        const selected = await this.userContextService.selectContext(
          user.id,
          SelectableContextTypeEnum.INDIVIDUAL_TEACHER,
          undefined,
          only.teacher_id,
          { device },
        );
        return { ...selected, requires_context_selection: false };
      }
    }

    // Multiple (or zero) contexts: land on dashboard; pick from dashboard/header.
    const token = await this.userService.generateTokenForUser(user, null, {
      context_type: 'individual',
      device,
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

  /** Switching workspace keeps the same signed-in device (`sessionId`, the JWT's sid). */
  async selectContext(
    userId: string,
    type: SelectableContextTypeEnum,
    organizationId?: string,
    teacherId?: string,
    sessionId?: string,
  ) {
    return this.userContextService.selectContext(userId, type, organizationId, teacherId, { session_id: sessionId });
  }

  async loginOrganization(dto: LoginOrganizationDto, device?: DeviceInfo): Promise<UserReponseDto & { contexts: unknown[] }> {
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
      organization_default_locale: organization.default_locale,
      organization_workspace_type: organization.workspace_type,
    }, {
      context_type: 'organization',
      device,
    });

    const contexts = await this.userContextService.listContexts(user.id);
    return { ...token, contexts };
  }

  /** The device's next token pair (PM-01: the token rotates; the device stays the same). */
  async refreshToken(refreshToken: string, organizationId?: string, device?: DeviceInfo): Promise<UserReponseDto> {
    const { user, sessionId } = await this.userService.consumeRefreshToken(refreshToken, device);
    if (!organizationId) {
      return this.userService.generateTokenForUser(user, null, { session_id: sessionId, device });
    }
    const { organization, membership } =
      await this.organizationsService.findMembershipByOrgId(organizationId, user.id);
    return this.userService.generateTokenForUser(
      user,
      {
        organization_id: organization.id,
        organization_number: Number(organization.organization_number),
        member_role: membership.role,
        organization_name: organization.name,
        organization_status: organization.status,
        organization_default_locale: organization.default_locale,
        organization_workspace_type: organization.workspace_type,
      },
      { session_id: sessionId, device },
    );
  }

  /** Signs out the device that holds this refresh token (PM-01). Always succeeds. */
  async logout(refreshToken: string): Promise<void> {
    await this.refreshTokens.revokeByToken(refreshToken);
  }

  /** The user's signed-in devices; `current` is the one asking. */
  async listDevices(userId: string, sessionId?: string): Promise<SignedInDevice[]> {
    return this.refreshTokens.list(userId, sessionId);
  }

  async signOutDevice(userId: string, deviceId: string): Promise<void> {
    await this.refreshTokens.revokeOne(userId, deviceId);
  }

  /** "Sign out all other devices": keeps the one asking. */
  async signOutOtherDevices(userId: string, sessionId?: string): Promise<{ signed_out: number }> {
    const count = await this.refreshTokens.revokeAll(userId, RefreshTokenRevokeReasonEnum.SIGNED_OUT_ELSEWHERE, sessionId ?? null);
    this.recordSignOut(userId, count, RefreshTokenRevokeReasonEnum.SIGNED_OUT_ELSEWHERE);
    return { signed_out: count };
  }

  private recordSignOut(userId: string, count: number, reason: RefreshTokenRevokeReasonEnum): void {
    this.audit.record({
      action: AUDIT_ACTIONS.USER_SIGN_OUT_DEVICES,
      actorId: userId,
      entityType: 'user',
      entityId: userId,
      after: { devices: count },
      reason,
    });
  }

  async getProfile(userId: string) {
    return await this.userService.getProfile(userId);
  }

  /** A new password signs every other device out (PM-01); the one changing it stays signed in. */
  async changePassword(userId: string, changePasswordDto: ChangePasswordDto, sessionId?: string) {
    if (changePasswordDto.new_password !== changePasswordDto.confirm_password) {
      throw new BadRequestException('New password and confirm password do not match');
    }

    await this.userService.changePassword(
      userId,
      changePasswordDto.current_password,
      changePasswordDto.new_password,
    );
    const signedOut = await this.refreshTokens.revokeAll(userId, RefreshTokenRevokeReasonEnum.PASSWORD_CHANGED, sessionId ?? null);
    this.recordSignOut(userId, signedOut, RefreshTokenRevokeReasonEnum.PASSWORD_CHANGED);

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
      throw new NotFoundException({ message: 'No account found with this phone number or email', code: AUTH_ERRORS.ACCOUNT_NOT_FOUND });
    }

    // A new code does not lift a wrong-guess lockout.
    await this.smsRateLimitService.assertOtpNotLocked('reset', identifier);

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
      await this.queueResetCode(user.id, NotificationChannelEnum.EMAIL, user.email, otp, user.full_name);

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

    await this.queueResetCode(user.id, NotificationChannelEnum.SMS, user.phone, otp, user.full_name);

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

    await this.assertResetOtp(identifier, verifyResetOtpDto.otp);

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

    await this.assertResetOtp(identifier, resetPasswordDto.otp);

    const user = await this.userService.findByPhoneOrEmail(identifier);
    if (!user) {
      throw new NotFoundException({ message: 'No account found with this phone number or email', code: AUTH_ERRORS.ACCOUNT_NOT_FOUND });
    }

    await this.userService.updatePassword(user.id, resetPasswordDto.password);
    // A reset (forgotten password) signs every device out (PM-01).
    const signedOut = await this.refreshTokens.revokeAll(user.id, RefreshTokenRevokeReasonEnum.PASSWORD_RESET);
    this.recordSignOut(user.id, signedOut, RefreshTokenRevokeReasonEnum.PASSWORD_RESET);
    await this.smsRateLimitService.removePasswordResetOtp(identifier);

    return {
      success: true,
      message: 'Password reset successfully. You can now login with your new password.',
      data: { passwordReset: true },
    };
  }

  /** Checks a reset OTP; wrong codes count towards the lockout (429 when locked). */
  private async assertResetOtp(identifier: string, otp: string): Promise<void> {
    const storedOtp = await this.smsRateLimitService.getPasswordResetOtp(identifier);
    const result = await this.smsRateLimitService.checkOtpAttempt('reset', identifier, otp, storedOtp);
    if (result === 'expired') {
      throw new BadRequestException({ message: 'OTP expired or not found. Please request a new code.', code: AUTH_ERRORS.OTP_EXPIRED });
    }
    if (result === 'invalid') {
      throw new BadRequestException({ message: 'Invalid OTP. Please try again.', code: AUTH_ERRORS.OTP_INVALID });
    }
  }

  /** The reset code goes out through the outbox (urgent, platform-paid), in the user's language. */
  private async queueResetCode(
    userId: string,
    channel: NotificationChannelEnum,
    address: string,
    otp: string,
    name: string | null | undefined,
  ): Promise<void> {
    await this.notifications.enqueue({
      eventType: NOTIFICATION_EVENTS.AUTH_PASSWORD_RESET,
      channel,
      organizationId: null,
      userId,
      address,
      variables: { otp, name: name ?? '' },
      urgent: true,
    });
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
