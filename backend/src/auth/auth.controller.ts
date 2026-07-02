import { Controller, Post, Body, UseGuards, Get, HttpCode, HttpStatus, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { GoogleAuthService } from './google-auth.service';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags, ApiBody } from '@nestjs/swagger';
import { RegisterUserDto } from './dto/register-user.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyResetOtpDto } from './dto/verify-reset-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from './guards/jwt.guard';
import { UserPayload } from 'src/common/decorators/user-payload.decorator';
import { JwtPayloadInterface } from './interfaces/jwt-payload.interface';
import { VerifyOtpDto } from 'src/sms/dto/sms.dto';

@ApiTags('Authentication')
@Controller({
  path: 'auth',
  version: '1',
})
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly googleAuthService: GoogleAuthService,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register a new user',
    description: 'Register a new user with phone number (required), password, and optional email. An OTP will be sent to the provided phone number for verification. The user must verify the OTP before they can login. If a user previously registered but did not verify OTP, they can register again with the same phone number.',
  })
  @ApiBody({
    type: RegisterUserDto,
    description: 'User registration data. Phone number and password are required, email is optional.',
    examples: {
      withPhoneOnly: {
        value: {
          full_name: 'John Doe',
          phone: '01734911480',
          password: 'StrongPass123',
          confirm_password: 'StrongPass123',
          role: 'STUDENT'
        }
      },
      withPhoneAndEmail: {
        value: {
          full_name: 'Jane Smith',
          phone: '01712345678',
          email: 'jane@example.com',
          password: 'StrongPass123',
          confirm_password: 'StrongPass123',
          role: 'TEACHER'
        }
      }
    }
  })
  @ApiResponse({ 
    status: 201, 
    description: 'User registered successfully. OTP has been sent to the phone number.',
    schema: {
      example: {
        message: 'Registered successfully!',
        payload: {
          success: true,
          message: 'Registration successful. Please verify your phone number with the OTP sent.',
          data: {
            phone: '01734911480',
            email: 'user@example.com',
            otpSent: true,
            requiresPhoneVerification: true
          }
        }
      }
    }
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Validation error, password mismatch, duplicate verified email/phone, or failed to send OTP',
    schema: {
      example: {
        statusCode: 400,
        message: 'Phone number already registered and verified',
        error: 'Bad Request'
      }
    }
  })
  async register(@Body() registerUserDto: RegisterUserDto) {
    const payload = await this.authService.signUp(registerUserDto);
    return { message: 'Registered successfully!', payload };
  }

  @Post('register/verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify registration OTP',
    description: 'Verify the OTP sent during registration. This endpoint completes the registration process by verifying the phone number. After successful verification, the user can login. If classInvitationToken is provided, the user will be automatically added to the class.',
  })
  @ApiBody({
    type: VerifyOtpDto,
    description: 'Phone number and OTP code received via SMS',
    examples: {
      verifyOtp: {
        value: {
          phone: '01734911480',
          otp: '123456'
        }
      },
      verifyOtpWithClass: {
        value: {
          phone: '01734911480',
          otp: '123456',
          classInvitationToken: 'invitation-token-uuid'
        }
      }
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Phone number verified successfully. User can now login.',
    schema: {
      example: {
        message: 'Phone verified successfully',
        payload: {
          success: true,
          message: 'Phone verified successfully. You can now login.',
          data: {
            phone: '01734911480',
            phoneVerified: true
          }
        }
      }
    }
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid OTP, expired OTP, or OTP not found',
    schema: {
      example: {
        statusCode: 400,
        message: 'Invalid OTP. Please try again.',
        error: 'Bad Request'
      }
    }
  })
  @ApiResponse({ 
    status: 404, 
    description: 'User not found with the provided phone number',
    schema: {
      example: {
        statusCode: 404,
        message: 'No user found with this phone number',
        error: 'Not Found'
      }
    }
  })
  async verifyRegistrationOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    const payload = await this.authService.verifyPhoneForRegistration(
      verifyOtpDto,
      verifyOtpDto.classInvitationToken,
    );
    return { message: 'Phone verified successfully', payload };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login with password',
    description: 'Login using phone number or email address with password. Returns a JWT access token on successful authentication. The token expires in 30 minutes. User must have verified their phone number with OTP before logging in.',
  })
  @ApiBody({
    type: LoginDto,
    description: 'Phone number or email, and password',
    examples: {
      loginWithPhone: {
        value: {
          phone: '01734911480',
          password: 'StrongPass123'
        }
      },
      loginWithEmail: {
        value: {
          email: 'user@example.com',
          password: 'StrongPass123'
        }
      }
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Login successful. Returns user data and JWT access token.',
    schema: {
      example: {
        message: 'Login successful!',
        payload: {
          id: 'user-uuid',
          full_name: 'John Doe',
          email: 'user@example.com',
          phone: '01734911480',
          role: 'STUDENT',
          is_verified: true,
          access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
        }
      }
    }
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Invalid credentials or user not verified',
    schema: {
      example: {
        statusCode: 401,
        message: 'Invalid login credentials',
        error: 'Unauthorized'
      }
    }
  })
  async login(@Body() loginDto: LoginDto) {
    const payload = await this.authService.login(loginDto);
    return { message: 'Login successful!', payload };
  }

  @Get('google')
  @ApiOperation({
    summary: 'Start Google sign-in',
    description: 'Redirects the browser to Google OAuth consent screen.',
  })
  @ApiResponse({ status: 302, description: 'Redirect to Google OAuth' })
  async googleAuth(@Res() res: Response) {
    const url = this.googleAuthService.buildAuthorizationUrl();
    return res.redirect(url);
  }

  @Get('google/callback')
  @ApiOperation({
    summary: 'Google OAuth callback',
    description: 'Handles Google redirect, creates or links the user, then redirects to the frontend with tokens.',
  })
  @ApiResponse({ status: 302, description: 'Redirect to frontend callback page' })
  async googleAuthCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    if (error) {
      return res.redirect(
        this.googleAuthService.buildFrontendFailureRedirect('Google sign-in was cancelled'),
      );
    }

    try {
      const payload = await this.googleAuthService.handleCallback(code, state);
      return res.redirect(this.googleAuthService.buildFrontendSuccessRedirect(payload));
    } catch (callbackError) {
      const message =
        callbackError instanceof Error ? callbackError.message : 'Google sign-in failed';
      return res.redirect(this.googleAuthService.buildFrontendFailureRedirect(message));
    }
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request a password reset OTP',
    description:
      'Accepts a phone number or email. If an account exists, a 6-digit OTP is generated, logged to the server console, and sent to the account\'s phone (SMS) and email. The OTP is valid for 5 minutes.',
  })
  @ApiBody({
    type: ForgotPasswordDto,
    examples: {
      withPhone: { value: { identifier: '01734911480' } },
      withEmail: { value: { identifier: 'user@example.com' } },
    },
  })
  @ApiResponse({ status: 200, description: 'OTP sent to the account phone and email' })
  @ApiResponse({ status: 404, description: 'No account found with this phone number or email' })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    const payload = await this.authService.forgotPassword(forgotPasswordDto);
    return { message: payload.message, payload };
  }

  @Post('reset-password/verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify a password reset OTP',
    description: 'Verifies the OTP sent for password reset without consuming it. The same OTP is required to complete the reset.',
  })
  @ApiBody({
    type: VerifyResetOtpDto,
    examples: { verify: { value: { identifier: '01734911480', otp: '123456' } } },
  })
  @ApiResponse({ status: 200, description: 'OTP verified successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired OTP' })
  async verifyResetOtp(@Body() verifyResetOtpDto: VerifyResetOtpDto) {
    const payload = await this.authService.verifyResetOtp(verifyResetOtpDto);
    return { message: payload.message, payload };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset password using OTP',
    description: 'Sets a new password after verifying the OTP sent for password reset.',
  })
  @ApiBody({
    type: ResetPasswordDto,
    examples: {
      reset: {
        value: {
          identifier: '01734911480',
          otp: '123456',
          password: 'NewStrongPass123',
          confirm_password: 'NewStrongPass123',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'Invalid OTP or password mismatch' })
  @ApiResponse({ status: 404, description: 'No account found' })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    const payload = await this.authService.resetPassword(resetPasswordDto);
    return { message: payload.message, payload };
  }

  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Change password for the authenticated user',
    description: 'Allows a logged-in user to change their password by providing the current password, a new password, and confirmation.',
  })
  @ApiBody({
    type: ChangePasswordDto,
    examples: {
      change: {
        value: {
          current_password: 'StrongPass123',
          new_password: 'NewStrongPass123',
          confirm_password: 'NewStrongPass123',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  @ApiResponse({ status: 400, description: 'Current password incorrect or password mismatch' })
  @ApiResponse({ status: 401, description: 'Invalid, expired, or missing JWT token' })
  async changePassword(
    @UserPayload() jwtPayload: JwtPayloadInterface,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    const payload = await this.authService.changePassword(jwtPayload.id, changePasswordDto);
    return { message: payload.message, payload };
  }

  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get the authenticated user profile',
    description: 'Returns the profile details of the currently logged-in user based on the JWT token.',
  })
  @ApiResponse({ status: 200, description: 'Authenticated user profile' })
  @ApiResponse({ status: 401, description: 'Invalid, expired, or missing JWT token' })
  async getProfile(@UserPayload() jwtPayload: JwtPayloadInterface) {
    const payload = await this.authService.getProfile(jwtPayload.id);
    return { message: 'Profile retrieved successfully', payload };
  }

  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  @Get('verify-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify JWT token validity',
    description: 'Verify if the provided JWT token in the Authorization header is valid and not expired. Returns the decoded JWT payload containing user information. Use this endpoint to check token validity or get current user information.',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Token is valid. Returns the decoded JWT payload.',
    schema: {
      example: {
        payload: {
          id: 'user-uuid',
          email: 'user@example.com',
          full_name: 'John Doe',
          role: 'STUDENT',
          phone: '01734911480',
          iat: 1234567890,
          exp: 1234569690
        }
      }
    }
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Invalid, expired, or missing JWT token',
    schema: {
      example: {
        statusCode: 401,
        message: 'Unauthorized',
        error: 'Unauthorized'
      }
    }
  })
  async verifyToken(@UserPayload() jwtPayload: JwtPayloadInterface) {
    return { payload: jwtPayload };
  }
}
