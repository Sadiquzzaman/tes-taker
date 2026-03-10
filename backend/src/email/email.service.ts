import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('EMAIL_HOST', 'smtp.gmail.com'),
      port: this.configService.get<number>('EMAIL_PORT', 587),
      secure: false, // true for 465, false for other ports
      auth: {
        user: this.configService.get<string>('EMAIL_USER'),
        pass: this.configService.get<string>('EMAIL_PASSWORD'),
      },
    } as nodemailer.TransportOptions);
  }

  async sendInvitationEmail(
    email: string,
    invitationLink: string,
    className: string,
    teacherName?: string,
  ): Promise<boolean> {
    try {
      const fromEmail = this.configService.get<string>('EMAIL_FROM', 'ttestaker@gmail.com');
      
      const mailOptions = {
        from: `"TestTaker" <${fromEmail}>`,
        to: email,
        subject: `Invitation to join ${className} on TestTaker`,
        html: `
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
        `,
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('Email sent:', info.messageId);
      return true;
    } catch (error) {
      console.error('Failed to send email:', error);
      throw new BadRequestException(`Failed to send email: ${error.message}`);
    }
  }

  async sendEmail(to: string, subject: string, html: string): Promise<boolean> {
    try {
      const fromEmail = this.configService.get<string>('EMAIL_FROM', 'ttestaker@gmail.com');
      
      const mailOptions = {
        from: `"TestTaker" <${fromEmail}>`,
        to,
        subject,
        html,
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('Email sent:', info.messageId);
      return true;
    } catch (error) {
      console.error('Failed to send email:', error);
      return false;
    }
  }
}
