import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { SmsRateLimitService } from './sms-rate-limit.service';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly smsRateLimitService: SmsRateLimitService,
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

  async sendSms(phoneNumber: string, message: string): Promise<boolean> {
    try {
      const apiKey = this.getApiKey();
      const senderId = this.getSenderId();
      const baseUrl = this.getBaseUrl();


      const url = `${baseUrl}?api_key=${apiKey}&type=text&number=${phoneNumber}&senderid=${senderId}&message=${encodeURIComponent(message)}`;

      const response = await axios.post(url);

      this.logger.debug(`BulkSMS response: ${JSON.stringify(response.data)}`);

      // Check if SMS was sent successfully
      // The API response format may vary, adjust according to bulksmsbd documentation
      return response.status === 200;
    } catch (error) {
      this.logger.error(
        `SMS sending failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  async sendOtp(phoneNumber: string): Promise<{ success: boolean; otp?: string; message: string }> {
    // Check rate limiting
    const rateLimitCheck = await this.smsRateLimitService.canSendSms(phoneNumber);
    
    // if (!rateLimitCheck.canSend) {
    //   const message = rateLimitCheck.blockedUntil 
    //     ? `SMS blocked until ${rateLimitCheck.blockedUntil.toLocaleString()}. Please try again later.`
    //     : 'SMS limit exceeded. Please try again later.';
      
    //   return { 
    //     success: false, 
    //     message 
    //   };
    // }

    // Generate OTP
    const otp = this.generateOtp();
    // Never log OTPs in production.
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[OTP] phone: ${phoneNumber} | otp: ${otp}`);
      this.logger.log(`[OTP] phone: ${phoneNumber} | otp: ${otp}`);
    }

    
    // Send SMS
    const smsMessage = `Your OTP is: ${otp}. Valid for 5 minutes.`;
    const smsSent = await this.sendSms(phoneNumber, smsMessage);
    
    if (smsSent) {
      // Store OTP in Redis
      await this.smsRateLimitService.storeOtp(phoneNumber, otp);
      
      // Record the attempt
      await this.smsRateLimitService.recordSmsAttempt(phoneNumber);
      
      return { 
        success: true, 
        otp, 
        message: `OTP sent successfully. ${(rateLimitCheck.remainingAttempts ?? 1) - 1} attempts remaining.` 
      };
    } else {
      return { 
        success: false, 
        message: 'Failed to send OTP. Please try again.' 
      };
    }
  }

  async verifyOtp(phoneNumber: string, otp: string): Promise<{ success: boolean; message: string }> {
    const storedOtp = await this.smsRateLimitService.getOtp(phoneNumber);
    
    if (!storedOtp) {
      return { 
        success: false, 
        message: 'OTP expired or not found. Please request a new OTP.' 
      };
    }
    
    if (storedOtp === otp) {
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

  generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
} 