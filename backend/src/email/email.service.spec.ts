import { Logger } from '@nestjs/common';
import { EmailService } from './email.service';

const configWith = (values: Record<string, string | undefined>) => ({
  get: jest.fn((key: string, fallback?: string) => values[key] ?? fallback),
});

describe('EmailService start-up', () => {
  afterEach(() => jest.restoreAllMocks());

  it('reports a missing BREVO_API_KEY and never looks for SMTP settings', () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const config = configWith({ EMAIL_USER: 'smtp-user', EMAIL_PASSWORD: 'smtp-pass' });

    new EmailService(config as never);

    expect(error).toHaveBeenCalledWith('Email service not configured. Please set BREVO_API_KEY.');
    const readKeys = config.get.mock.calls.map(([key]) => key);
    expect(readKeys).not.toContain('EMAIL_USER');
    expect(readKeys).not.toContain('EMAIL_PASSWORD');
  });

  it('refuses to send without Brevo instead of silently using SMTP', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const service = new EmailService(configWith({}) as never);

    await expect(service.sendInvitationEmail('a@example.com', 'https://x', 'Class')).rejects.toThrow(
      /Please set BREVO_API_KEY/,
    );
  });
});
