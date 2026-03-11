import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BrevoClient } from '@getbrevo/brevo';

@Injectable()
export class EmailService {
  private brevoClient: BrevoClient;
  private fromEmail: string;
  private fromName: string;
  private useBrevo: boolean;

  constructor(private readonly configService: ConfigService) {
    // Check if Brevo API key is configured
    const brevoApiKey = this.configService.get<string>('BREVO_API_KEY');
    this.fromEmail = this.configService.get<string>('EMAIL_FROM', 'noreply@testtaker.com');
    this.fromName = this.configService.get<string>('EMAIL_FROM_NAME', 'TestTaker');
    this.useBrevo = !!brevoApiKey;

    if (this.useBrevo && brevoApiKey) {
      // Initialize Brevo API client
      this.brevoClient = new BrevoClient({
        apiKey: brevoApiKey,
      });
      console.log('Email service initialized with Brevo API (Free: 300 emails/day)');
    } else {
      console.warn('Email service: BREVO_API_KEY not found. Please configure Brevo API key.');
      console.warn('Sign up for free at: https://www.brevo.com/ (300 emails/day free)');
      // Fallback: try to initialize with nodemailer if SMTP is configured
      const emailUser = this.configService.get<string>('EMAIL_USER');
      const emailPassword = this.configService.get<string>('EMAIL_PASSWORD');
      if (emailUser && emailPassword) {
        console.warn('Falling back to SMTP (nodemailer). Consider using Brevo for better reliability.');
      } else {
        console.error('Email service not configured. Please set BREVO_API_KEY in your .env file');
      }
    }
  }

  async sendInvitationEmail(
    email: string,
    invitationLink: string,
    className: string,
    teacherName?: string,
  ): Promise<boolean> {
    try {
      if (!this.useBrevo || !this.brevoClient) {
        throw new Error('Email service not configured. Please set BREVO_API_KEY in your .env file');
      }

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">You've been invited to join a class!</h2>
          <p>Hello,</p>
          <p>${teacherName || 'A teacher'} has invited you to join the class <strong>${className}</strong> on TestTaker.</p>
          <p>Click the link below to register and join the class:</p>
          <p style="margin: 30px 0;">
            <a href="${invitationLink}" 
               style="background-color: #4CAF50; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 5px; display: inline-block;">
              Join Class
            </a>
          </p>
          <p>Or copy and paste this link into your browser:</p>
          <p style="color: #666; word-break: break-all;">${invitationLink}</p>
          <p style="margin-top: 30px; color: #666; font-size: 12px;">
            This invitation link will expire in 7 days.
          </p>
          <p style="margin-top: 20px; color: #666; font-size: 12px;">
            If you didn't expect this invitation, you can safely ignore this email.
          </p>
        </div>
      `;

      const result = await this.brevoClient.transactionalEmails.sendTransacEmail({
        subject: `Invitation to join ${className} on TestTaker`,
        htmlContent: html,
        sender: { name: this.fromName, email: this.fromEmail },
        to: [{ email }],
      });

      console.log('Email sent via Brevo:', result.messageId);
      return true;
    } catch (error) {
      console.error('Failed to send email:', error);
      throw new BadRequestException(`Failed to send email: ${error.message}`);
    }
  }

  async sendEmail(to: string, subject: string, html: string): Promise<boolean> {
    try {
      if (!this.useBrevo || !this.brevoClient) {
        console.error('Email service not configured. Please set BREVO_API_KEY in your .env file');
        return false;
      }

      const result = await this.brevoClient.transactionalEmails.sendTransacEmail({
        subject,
        htmlContent: html,
        sender: { name: this.fromName, email: this.fromEmail },
        to: [{ email: to }],
      });

      console.log('Email sent via Brevo:', result.messageId);
      return true;
    } catch (error) {
      console.error('Failed to send email:', error);
      return false;
    }
  }
}
