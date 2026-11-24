import { BadRequestException, ConflictException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EnrolmentsService } from 'src/academics/enrolments.service';
import { AUDIT_ACTIONS } from 'src/audit/audit-actions';
import { AuditService } from 'src/audit/audit.service';
import { NOTIFICATION_EVENTS, NotificationChannelEnum } from 'src/notifications/notification.constants';
import { NotificationsService } from 'src/notifications/notifications.service';
import { OrganizationsService } from 'src/organizations/organization.service';
import { SmsRateLimitService } from 'src/sms/sms-rate-limit.service';
import { SmsService } from 'src/sms/sms.service';
import { RefreshTokenRevokeReasonEnum } from 'src/user/entities/refresh-token.entity';
import { RefreshTokensService } from 'src/user/refresh-tokens.service';
import { UserService } from 'src/user/user.service';
import { AUTH_ERRORS } from './auth-errors';
import { DeleteAccountDto } from './dto/delete-account.dto';

export type AccountDeletionStatus =
  | { canDelete: true }
  | { canDelete: false; code: typeof AUTH_ERRORS.OWNER_MUST_TRANSFER; organizations: { id: string; name: string }[] };

/**
 * Deleting one's own account (mobile-api #358; both app stores require it). The owner's rule is no
 * hard deletes: the account is deactivated and anonymised, every device is signed out, the person
 * leaves their classes and organisations, and the school's history (marks, attendance, messages)
 * stays under "Deleted user". An organisation owner is refused until the organisation has another
 * owner or is closed; their own solo workspace closes with the account.
 */
@Injectable()
export class AccountDeletionService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly users: UserService,
    private readonly organizations: OrganizationsService,
    private readonly enrolments: EnrolmentsService,
    private readonly refreshTokens: RefreshTokensService,
    private readonly sms: SmsService,
    private readonly smsLimits: SmsRateLimitService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  async status(userId: string): Promise<AccountDeletionStatus> {
    const organizations = await this.organizations.organizationsBlockingAccountDeletion(userId);
    return organizations.length === 0 ? { canDelete: true } : { canDelete: false, code: AUTH_ERRORS.OWNER_MUST_TRANSFER, organizations };
  }

  /** Sends the confirmation code to the account's phone (the sign-up SMS limit applies). */
  async sendCode(userId: string): Promise<{ maskedPhone: string }> {
    const user = await this.users.findById(userId);
    await this.assertMayDelete(userId);
    await this.smsLimits.assertOtpNotLocked('delete', userId);
    const { canSend } = await this.smsLimits.canSendSms(user.phone);
    if (!canSend) {
      throw new HttpException({ message: 'Too many codes sent. Please try again later.', code: AUTH_ERRORS.OTP_SEND_FAILED }, HttpStatus.TOO_MANY_REQUESTS);
    }
    const otp = this.sms.generateOtp();
    await this.smsLimits.storeAccountDeletionOtp(userId, otp);
    await this.smsLimits.recordSmsAttempt(user.phone);
    await this.notifications.enqueue({
      eventType: NOTIFICATION_EVENTS.AUTH_ACCOUNT_DELETION,
      channel: NotificationChannelEnum.SMS,
      organizationId: null,
      userId,
      address: user.phone,
      variables: { otp },
      urgent: true,
    });
    return { maskedPhone: `${user.phone.slice(0, 3)}****${user.phone.slice(-2)}` };
  }

  async delete(userId: string, dto: DeleteAccountDto): Promise<{ deleted: true }> {
    await this.assertMayDelete(userId);
    await this.assertConfirmed(userId, dto);

    await this.dataSource.transaction(async (manager) => {
      await this.organizations.releaseDeletedUser(userId, manager);
      await this.enrolments.markAllLeftForDeletedStudent(userId, manager);
      await this.users.anonymise(userId, dto.reason ?? null, manager);
    });
    const devices = await this.refreshTokens.revokeAll(userId, RefreshTokenRevokeReasonEnum.ACCOUNT_DELETED);
    await this.smsLimits.removeAccountDeletionOtp(userId);
    this.audit.record({
      action: AUDIT_ACTIONS.USER_ACCOUNT_DELETED,
      actorId: userId,
      entityType: 'user',
      entityId: userId,
      after: { devices_signed_out: devices },
    });
    return { deleted: true };
  }

  private async assertMayDelete(userId: string): Promise<void> {
    const status = await this.status(userId);
    if (!status.canDelete) {
      throw new ConflictException({
        message: 'You own an organisation. Ask support to give it another owner or close it, then delete your account.',
        code: AUTH_ERRORS.OWNER_MUST_TRANSFER,
        details: { organizations: status.organizations },
      });
    }
  }

  /** The password or the code; wrong answers of either kind count towards the 15-minute lock (429). */
  private async assertConfirmed(userId: string, dto: DeleteAccountDto): Promise<void> {
    if (dto.otp) {
      const stored = await this.smsLimits.getAccountDeletionOtp(userId);
      const result = await this.smsLimits.checkOtpAttempt('delete', userId, dto.otp, stored);
      if (result === 'expired') {
        throw new BadRequestException({ message: 'The code has expired. Please ask for a new one.', code: AUTH_ERRORS.OTP_EXPIRED });
      }
      if (result === 'invalid') throw new BadRequestException({ message: 'Wrong code. Please try again.', code: AUTH_ERRORS.OTP_INVALID });
      return;
    }
    if (!dto.password) {
      throw new BadRequestException({ message: 'Enter your password or the code we sent you', code: AUTH_ERRORS.INVALID_PASSWORD });
    }
    await this.smsLimits.assertOtpNotLocked('delete', userId);
    if (!(await this.users.passwordMatches(userId, dto.password))) {
      await this.smsLimits.countWrongAttempt('delete', userId);
      throw new BadRequestException({ message: 'The password is not correct', code: AUTH_ERRORS.INVALID_PASSWORD });
    }
    await this.smsLimits.clearWrongAttempts('delete', userId);
  }
}
