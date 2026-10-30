import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { randomInt } from 'crypto';
import { NOTIFICATION_EVENTS, NotificationChannelEnum, NotificationLocale } from '../notifications/notification.constants';
import { NotificationsService } from '../notifications/notifications.service';
import { SmsRateLimitService } from './sms-rate-limit.service';

/** BulkSMS BD's JSON answer (fields we read). */
interface BulkSmsResponse {
  response_code?: number | string;
  message_id?: number | string;
  error_message?: string;
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly smsRateLimitService: SmsRateLimitService,
    private readonly notifications: NotificationsService,
  ) {}

  private getApiKey(): string {
    const apiKey = this.configService.get<string>('BULKSMS_API_KEY');
    if (!apiKey) {
      throw new BadRequestException('BULKSMS_API_KEY is not configured');
    }
    return apiKey;
  }
  
  private getSenderId(): string {
    const senderId = this.configService.get<string>('BULKSMS_SENDER_ID');
    if (!senderId) {
      throw new BadRequestException('BULKSMS_SENDER_ID is not configured');
    }
    return senderId;
  }

  private getBaseUrl(): string {
    return 'http://bulksmsbd.net/api/smsapi';
  }

  /**
   * Sends one SMS through BulkSMS BD or throws. Only the notification worker calls it (design §8.6):
   * features queue SMS with NotificationsService.enqueue, never send them from a request.
   */
  async deliver(phoneNumber: string, message: string): Promise<{ messageId: string | null }> {
    const apiKey = this.getApiKey();
    const senderId = this.getSenderId();
    const baseUrl = this.getBaseUrl();

    const url = `${baseUrl}?api_key=${apiKey}&type=text&number=${encodeURIComponent(phoneNumber)}&senderid=${senderId}&message=${encodeURIComponent(message)}`;

    const response = await axios.post<BulkSmsResponse>(url, undefined, { timeout: 15_000 });
    const data = response.data;
    // BulkSMS BD answers 200 with response_code 202 when the SMS is accepted.
    if (response.status !== 200 || (data?.response_code !== undefined && Number(data.response_code) !== 202)) {
      throw new Error(`BulkSMS rejected the SMS: ${data?.error_message || data?.response_code || response.status}`);
    }
    return { messageId: data?.message_id !== undefined ? String(data.message_id) : null };
  }

  async sendOtp(
    phoneNumber: string,
    locale?: NotificationLocale,
  ): Promise<{ success: boolean; otp?: string; message: string }> {
    // A new code does not lift a wrong-guess lockout.
    await this.smsRateLimitService.assertOtpNotLocked('register', phoneNumber);

    // Check rate limiting: 3 SMS per phone per hour, then blocked for an hour (limits SMS cost).
    const rateLimitCheck = await this.smsRateLimitService.canSendSms(phoneNumber);

    if (!rateLimitCheck.canSend) {
      const message = rateLimitCheck.blockedUntil
        ? `SMS blocked until ${rateLimitCheck.blockedUntil.toLocaleString()}. Please try again later.`
        : 'SMS limit exceeded. Please try again later.';

      return {
        success: false,
        message,
      };
    }

    // Generate OTP
    const otp = this.generateOtp();
    // Never log OTPs in production.
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[OTP] phone: ${phoneNumber} | otp: ${otp}`);
      this.logger.log(`[OTP] phone: ${phoneNumber} | otp: ${otp}`);
    }

    
    // Store the code, then queue the SMS (sent by the worker within seconds; platform-paid).
    await this.smsRateLimitService.storeOtp(phoneNumber, otp);
    await this.notifications.enqueue({
      eventType: NOTIFICATION_EVENTS.AUTH_OTP,
      channel: NotificationChannelEnum.SMS,
      organizationId: null,
      address: phoneNumber,
      locale,
      variables: { otp },
      urgent: true,
    });
    await this.smsRateLimitService.recordSmsAttempt(phoneNumber);

    return {
      success: true,
      otp,
      message: `OTP sent successfully. ${(rateLimitCheck.remainingAttempts ?? 1) - 1} attempts remaining.`,
    };
  }

  async verifyOtp(phoneNumber: string, otp: string): Promise<{ success: boolean; message: string }> {
    const storedOtp = await this.smsRateLimitService.getOtp(phoneNumber);
    // Throws 429 once the phone is locked after too many wrong codes.
    const result = await this.smsRateLimitService.checkOtpAttempt('register', phoneNumber, otp, storedOtp);

    if (result === 'expired') {
      return { 
        success: false, 
        message: 'OTP expired or not found. Please request a new OTP.' 
      };
    }
    
    if (result === 'valid') {
      // Remove OTP after successful verification
      await this.smsRateLimitService.removeOtp(phoneNumber);
      return { 
        success: true, 
        message: 'OTP verified successfully.' 
      };
    } else {
      return { 
        success: false, 
        message: 'Invalid OTP. Please try again.' 
      };
    }
  }

  async getSmsStatus(phoneNumber: string) {
    return await this.smsRateLimitService.getSmsStatus(phoneNumber);
  }

  async resetSmsCache(phoneNumber?: string): Promise<{ success: boolean; message: string }> {
    await this.smsRateLimitService.resetSmsCache(phoneNumber);
    return { 
      success: true, 
      message: phoneNumber 
        ? `SMS cache reset for ${phoneNumber}` 
        : 'All SMS cache reset successfully' 
    };
  }

  /** 6-digit OTP from a cryptographically secure source (100000–999999). */
  generateOtp(): string {
    return randomInt(100000, 1000000).toString();
  }
} 