import { ConfigService } from '@nestjs/config';

/**
 * Public frontend origin for invitation / share / OAuth redirect links.
 * Prefer FRONTEND_BASE_URL, then FRONTEND_URL. Never hardcode a product domain.
 */
export function resolveFrontendUrl(configService: ConfigService, fallback = 'http://localhost:3000'): string {
  const raw =
    configService.get<string>('FRONTEND_BASE_URL')?.trim() ||
    configService.get<string>('FRONTEND_URL')?.trim() ||
    fallback;

  return raw.replace(/\/+$/, '');
}
