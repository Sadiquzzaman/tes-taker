import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { randomBytes } from 'crypto';
import { UserService } from 'src/user/user.service';

type GoogleTokenResponse = {
  access_token?: string;
  id_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
};

type GoogleUserInfo = {
  sub: string;
  email?: string;
  email_verified?: boolean | string;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
};

@Injectable()
export class GoogleAuthService {
  private readonly pendingStates = new Map<string, number>();

  constructor(
    private readonly configService: ConfigService,
    private readonly userService: UserService,
  ) {}

  private getClientId(): string {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    if (!clientId) {
      throw new BadRequestException('Google sign-in is not configured');
    }
    return clientId;
  }

  private getClientSecret(): string {
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');
    if (!clientSecret) {
      throw new BadRequestException('Google sign-in is not configured');
    }
    return clientSecret;
  }

  private getCallbackUrl(): string {
    return (
      this.configService.get<string>('GOOGLE_CALLBACK_URL') ??
      `${this.getBackendBaseUrl()}/api/v1/auth/google/callback`
    );
  }

  private getBackendBaseUrl(): string {
    return this.configService.get<string>('BACKEND_BASE_URL', 'http://localhost:4000');
  }

  private getFrontendUrl(): string {
    return this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
  }

  private createStateToken(): string {
    const state = randomBytes(24).toString('hex');
    this.pendingStates.set(state, Date.now());
    return state;
  }

  private assertValidState(state: string): void {
    const createdAt = this.pendingStates.get(state);
    this.pendingStates.delete(state);

    if (!createdAt) {
      throw new UnauthorizedException('Invalid or expired Google sign-in state');
    }

    const maxAgeMs = 10 * 60 * 1000;
    if (Date.now() - createdAt > maxAgeMs) {
      throw new UnauthorizedException('Google sign-in session expired. Please try again.');
    }
  }

  buildAuthorizationUrl(): string {
    const clientId = this.getClientId();
    const redirectUri = encodeURIComponent(this.getCallbackUrl());
    const state = this.createStateToken();
    const scope = encodeURIComponent('openid email profile');

    return (
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${redirectUri}` +
      `&response_type=code` +
      `&scope=${scope}` +
      `&access_type=online` +
      `&prompt=select_account` +
      `&state=${state}`
    );
  }

  async handleCallback(code: string, state: string) {
    if (!code?.trim()) {
      throw new BadRequestException('Missing Google authorization code');
    }

    this.assertValidState(state);

    const tokenResponse = await axios.post<GoogleTokenResponse>(
      'https://oauth2.googleapis.com/token',
      new URLSearchParams({
        code,
        client_id: this.getClientId(),
        client_secret: this.getClientSecret(),
        redirect_uri: this.getCallbackUrl(),
        grant_type: 'authorization_code',
      }).toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      },
    );

    const accessToken = tokenResponse.data.access_token;
    if (!accessToken) {
      throw new UnauthorizedException('Failed to authenticate with Google');
    }

    const profileResponse = await axios.get<GoogleUserInfo>(
      'https://www.googleapis.com/oauth2/v3/userinfo',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    const profile = profileResponse.data;
    if (!profile.sub) {
      throw new UnauthorizedException('Google profile is missing a user id');
    }

    if (!profile.email) {
      throw new BadRequestException('Google account must have a verified email address');
    }

    const user = await this.userService.findOrCreateGoogleUser({
      googleId: profile.sub,
      email: profile.email.toLowerCase(),
      fullName:
        profile.name?.trim() ||
        [profile.given_name, profile.family_name].filter(Boolean).join(' ').trim() ||
        profile.email.split('@')[0],
    });

    return this.userService.generateTokenForUser(user);
  }

  buildFrontendSuccessRedirect(payload: Awaited<ReturnType<UserService['generateTokenForUser']>>): string {
    const frontendUrl = this.getFrontendUrl().replace(/\/$/, '');
    const params = new URLSearchParams({
      access_token: payload.access_token,
      refresh_token: payload.refresh_token ?? '',
      role: payload.role,
      id: payload.id,
      full_name: payload.full_name ?? '',
      email: payload.email ?? '',
      phone: payload.phone ?? '',
    });

    return `${frontendUrl}/auth/google/callback?${params.toString()}`;
  }

  buildFrontendFailureRedirect(message: string): string {
    const frontendUrl = this.getFrontendUrl().replace(/\/$/, '');
    return `${frontendUrl}/auth/google/callback?error=${encodeURIComponent(message)}`;
  }
}
