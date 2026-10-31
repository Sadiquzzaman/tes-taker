import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BrevoClient } from '@getbrevo/brevo';

/**
 * Sends one email through Brevo. Only the notification worker calls it (design §8.6): features
 * queue emails with NotificationsService.enqueue, never send them from a request.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private brevoClient: BrevoClient;
  private fromEmail: string;
  private fromName: string;
  private useBrevo: boolean;

  constructor(private readonly configService: ConfigService) {
    // Check if Brevo API key is configured
    const brevoApiKey = this.configService.get<string>('BREVO_API_KEY');
    this.fromEmail = this.configService.get<string>('EMAIL_FROM', 'noreply@testtaker.com');
    this.fromName = this.configService.get<string>('EMAIL_FROM_NAME', 'Instructor');
    this.useBrevo = !!brevoApiKey;

    if (this.useBrevo && brevoApiKey) {
      // Initialize Brevo API client
      this.brevoClient = new BrevoClient({
        apiKey: brevoApiKey,
      });
      this.logger.log('Email service initialized with Brevo API');
    } else {
      this.logger.error('Email service not configured. Please set BREVO_API_KEY.');
    }
  }

  /** Sends the email or throws (the worker records the error and retries). */
  async deliver(to: string, subject: string, html: string): Promise<{ messageId: string | null }> {
    if (!this.useBrevo || !this.brevoClient) {
      throw new Error('Email service not configured. Please set BREVO_API_KEY.');
    }

    const result = await this.brevoClient.transactionalEmails.sendTransacEmail({
      subject,
      htmlContent: html,
      sender: { name: this.fromName, email: this.fromEmail },
      to: [{ email: to }],
    });

    this.logger.log(`Email sent via Brevo (messageId: ${result.messageId})`);
    return { messageId: result.messageId ?? null };
  }
}
